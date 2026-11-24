"use client"

import type { RealtimeChannel } from "@supabase/supabase-js"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { nextPresenceState, type Availability, type PresenceEvent, type PresenceState } from "@/lib/presence/state"
import { onRemoteActivity } from "@/lib/realtime/activity"
import { planPresenceSend } from "@/lib/realtime/presenceBudget"
import { mergeFriendTopics, stateOfTopic, type PresencePayload } from "@/lib/realtime/presenceMerge"
import { closeChannel, openChannel } from "@/lib/realtime/channel"

/**
 * Each person's presence lives on their own private topic. Only they may track
 * there and only their accepted friends may listen (Realtime Authorization,
 * migration 20261124124401), so nobody else can see or fake it (docs/adr/0003).
 */
export function presenceTopic(userId: string): string {
  return `presence:${userId}`
}
/** How long a channel must stay joined before the reconnect backoff resets. */
const STABLE_AFTER_MS = 30_000
/** Wait before retrying a presence update the server did not accept. */
const SEND_RETRY_MS = 5_000

/** Pause before each reconnect attempt; the last value repeats. */
export const RECONNECT_BACKOFF_MS = [1000, 2000, 5000, 10000] as const
const ACTIVITY_THROTTLE_MS = 5000
/** How often the idle check runs. Keeps "away" within 10 s of the 5 min limit (Req 4.2). */
export const IDLE_CHECK_MS = 5000
const ACTIVITY_EVENTS = ["mousemove", "keydown", "mousedown", "focus", "visibilitychange"] as const

type TrackedPayload = { user_id: string; presence_state: PresenceState }

interface Connection {
  /** The channel once it has joined, or null while joining or waiting to reconnect. */
  current(): RealtimeChannel | null
  close(): Promise<void>
}

/**
 * Opens the shared presence channel and keeps it open: on CHANNEL_ERROR,
 * TIMED_OUT, or a close by the server it removes the channel and tries again
 * after 1s, 2s, 5s, then 10s.
 * `key` is the presence key (the user id) for the tracker; read-only
 * listeners pass nothing and never track.
 */
function openPresence(opts: {
  topic: string
  key?: string
  onPayload: (payload: PresencePayload) => void
  onSubscribed?: (channel: RealtimeChannel) => void
}): Connection {
  let channel: RealtimeChannel | null = null
  let joined = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let stableTimer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0
  let closed = false

  const connect = async () => {
    if (closed) return
    // Waits for an earlier removal of this topic (dev double-mount, reconnect).
    const ch = await openChannel(
      opts.topic,
      { config: opts.key ? { private: true, presence: { key: opts.key } } : { private: true } },
      () => closed,
    )
    if (!ch) return
    channel = ch
    joined = false
    const sync = () => opts.onPayload(ch.presenceState<TrackedPayload>())
    ch.on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (closed || channel !== ch) return
        if (status === "SUBSCRIBED") {
          joined = true
          // Reset the backoff only once the channel has stayed up, so a server
          // that closes it straight after the join can't cause a 1 s loop.
          stableTimer = setTimeout(() => {
            attempt = 0
          }, STABLE_AFTER_MS)
          opts.onSubscribed?.(ch)
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          // CLOSED here means the server ended it (we only remove channels after
          // setting `closed`), for example when its presence rate limit is hit.
          channel = null
          joined = false
          if (stableTimer) clearTimeout(stableTimer)
          void closeChannel(opts.topic, ch)
          const delay = RECONNECT_BACKOFF_MS[Math.min(attempt, RECONNECT_BACKOFF_MS.length - 1)]
          attempt += 1
          timer = setTimeout(() => void connect(), delay)
        }
      })
  }
  void connect()

  return {
    current: () => (joined ? channel : null),
    async close() {
      closed = true
      if (timer) clearTimeout(timer)
      if (stableTimer) clearTimeout(stableTimer)
      const ch = channel
      channel = null
      if (!ch) return
      const untrack = opts.key && joined ? () => ch.untrack() : undefined
      joined = false
      await closeChannel(opts.topic, ch, untrack)
    },
  }
}

export interface PresenceTracker {
  /** Leaves presence now, so friends see Offline at once (tray Exit, Req 16.8). */
  goOffline(): Promise<void>
  /** What the user chose for themselves; friends never see "invisible" (they see offline). */
  myState: Availability
  setBusy(): void
  setAvailable(): void
  setInvisible(): void
  friendsPresence: Record<string, PresenceState>
}

/**
 * Buddy List window ONLY. Tracks my presence and reports my friends' presence.
 * Chat windows must use `useFriendPresence` so one user keeps one presence entry.
 */
export function usePresenceTracker(
  me: string,
  friendIds: string[],
  options: { startInvisible?: boolean } = {},
): PresenceTracker {
  const initial: Availability = options.startInvisible ? "invisible" : "online"
  const [myState, setMyState] = useState<Availability>(initial)
  const stateRef = useRef<Availability>(initial)
  const lastActivityRef = useRef<number>(0)
  const lastEmitRef = useRef<number>(0)
  const trackRef = useRef<(() => void) | null>(null)
  const goOfflineRef = useRef<() => Promise<void>>(async () => {})

  const dispatch = useCallback((e: PresenceEvent) => {
    const next = nextPresenceState(stateRef.current, e)
    if (next === stateRef.current) return
    stateRef.current = next
    setMyState(next)
    // Re-track only when the state changed.
    trackRef.current?.()
  }, [])

  useEffect(() => {
    let conn: Connection | null = null
    goOfflineRef.current = async () => {
      trackRef.current = null
      await conn?.close()
    }
    // Supabase closes the channel after 5 presence updates in 30 s, so sends are
    // budgeted (lib/realtime/presenceBudget.ts) and coalesced: while over budget
    // we wait, then send only the latest state. The send history outlives
    // reconnects, because the limit counts this client.
    let sentAt: number[] = []
    let lastSent: Availability | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    const track = () => {
      const ch = conn?.current()
      if (!ch) return
      const want = stateRef.current
      if (want === lastSent) return
      const plan = planPresenceSend(sentAt, Date.now())
      sentAt = plan.recent
      if (!plan.sendNow) {
        scheduleRetry(plan.waitMs)
        return
      }
      sentAt.push(Date.now())
      lastSent = want
      // Invisible means "no presence entry": friends then see Offline (Req 12.7),
      // while this window keeps listening to its friends.
      const body: TrackedPayload | null = want === "invisible" ? null : { user_id: me, presence_state: want }
      void (body ? ch.track(body) : ch.untrack()).then(
        (result) => {
          if (result !== "ok") onSendFailed(want)
        },
        () => onSendFailed(want),
      )
    }
    function scheduleRetry(ms: number) {
      if (retry) return
      retry = setTimeout(() => {
        retry = null
        track()
      }, ms)
    }
    // The server didn't take it: forget it was sent and try again shortly.
    function onSendFailed(sent: Availability) {
      if (lastSent === sent) lastSent = null
      scheduleRetry(SEND_RETRY_MS)
    }
    // A fresh channel has no entry for us yet: the next track always goes out,
    // and Invisible needs nothing sent at all (there is nothing to untrack).
    const onSubscribed = () => {
      lastSent = stateRef.current === "invisible" ? "invisible" : null
      track()
    }
    trackRef.current = track
    lastActivityRef.current = Date.now()
    // My own topic: I track here and nobody else can. My state needs no listener.
    conn = openPresence({
      topic: presenceTopic(me),
      key: me,
      onPayload: () => undefined,
      onSubscribed,
    })

    const onActivity = () => {
      const now = Date.now()
      // Always record the time (cheap) so the throttle can never make "away" fire early.
      lastActivityRef.current = Math.max(lastActivityRef.current, now)
      // Throttle only the state transition, which may re-track.
      if (now - lastEmitRef.current < ACTIVITY_THROTTLE_MS) return
      lastEmitRef.current = now
      dispatch({ type: "activity", now })
    }
    // Chatting in a chat window counts as activity (Req 4.1, 4.2).
    const stopRemote = onRemoteActivity((at) => {
      lastActivityRef.current = Math.max(lastActivityRef.current, at)
      dispatch({ type: "activity", now: at })
    })
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity)
    const idle = setInterval(() => {
      dispatch({ type: "idleTimeout", now: Date.now(), lastActivityAt: lastActivityRef.current })
    }, IDLE_CHECK_MS)

    // Leave cleanly so friends see me go offline right away (Req 4.4).
    const onUnload = () => void conn?.close()
    window.addEventListener("beforeunload", onUnload)

    return () => {
      window.removeEventListener("beforeunload", onUnload)
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity)
      clearInterval(idle)
      if (retry) clearTimeout(retry)
      stopRemote()
      trackRef.current = null
      void conn?.close()
    }
  }, [me, dispatch])

  const goOffline = useCallback(() => goOfflineRef.current(), [])
  const setBusy = useCallback(() => dispatch({ type: "setBusy" }), [dispatch])
  const setInvisible = useCallback(() => dispatch({ type: "setInvisible" }), [dispatch])
  const setAvailable = useCallback(() => {
    lastActivityRef.current = Date.now()
    dispatch({ type: "setOnline" })
  }, [dispatch])

  const friendsPresence = useFriendsPresence(friendIds)

  return { myState, setBusy, setAvailable, setInvisible, friendsPresence, goOffline }
}

/**
 * Listens read-only on each friend's own presence topic. One channel per
 * friend; a friend who is not on the list any more is dropped.
 */
function useFriendsPresence(friendIds: readonly string[]): Record<string, PresenceState> {
  const [topics, setTopics] = useState<Record<string, PresencePayload>>({})
  const conns = useRef(new Map<string, Connection>())
  const idsKey = [...friendIds].sort().join(",")

  // Open a channel for each new friend and close it for each one who left;
  // friends already on the list keep their channel, so their state never blinks
  // offline (which would also fire the "is now online" alert again).
  useEffect(() => {
    const ids = new Set(idsKey ? idsKey.split(",") : [])
    const open = conns.current
    for (const [id, conn] of open) {
      if (ids.has(id)) continue
      void conn.close()
      open.delete(id)
      setTopics((cur) => {
        const next = { ...cur }
        delete next[id]
        return next
      })
    }
    for (const id of ids) {
      if (open.has(id)) continue
      open.set(
        id,
        openPresence({
          topic: presenceTopic(id),
          onPayload: (payload) => setTopics((cur) => ({ ...cur, [id]: payload })),
        }),
      )
    }
  }, [idsKey])

  useEffect(() => {
    const open = conns.current
    return () => {
      for (const conn of open.values()) void conn.close()
      open.clear()
    }
  }, [])

  return useMemo(() => mergeFriendTopics(topics, idsKey ? idsKey.split(",") : []), [topics, idsKey])
}

/**
 * For chat windows. Listens to the friend's presence topic but NEVER calls
 * track(), and cannot: only the topic's owner may track there.
 */
export function useFriendPresence(friendId: string): PresenceState {
  const [payload, setPayload] = useState<PresencePayload>({})

  useEffect(() => {
    const conn = openPresence({ topic: presenceTopic(friendId), onPayload: setPayload })
    return () => {
      void conn.close()
    }
  }, [friendId])

  return useMemo(() => stateOfTopic(payload), [payload])
}
