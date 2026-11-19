"use client"

import type { RealtimeChannel } from "@supabase/supabase-js"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { nextPresenceState, type Availability, type PresenceEvent, type PresenceState } from "@/lib/presence/state"
import { onRemoteActivity } from "@/lib/realtime/activity"
import { planPresenceSend } from "@/lib/realtime/presenceBudget"
import { mergePresence, type PresencePayload } from "@/lib/realtime/presenceMerge"
import { closeChannel, openChannel } from "@/lib/realtime/channel"

export const PRESENCE_CHANNEL = "presence:global"
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
      PRESENCE_CHANNEL,
      opts.key ? { config: { presence: { key: opts.key } } } : undefined,
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
          void closeChannel(PRESENCE_CHANNEL, ch)
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
      if (opts.key && joined) await ch.untrack().catch(() => undefined)
      joined = false
      await closeChannel(PRESENCE_CHANNEL, ch)
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
  const [payload, setPayload] = useState<PresencePayload>({})
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
    conn = openPresence({
      key: me,
      onPayload: setPayload,
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

  const idsKey = friendIds.join(",")
  const friendsPresence = useMemo(
    () => mergePresence(payload, idsKey ? idsKey.split(",") : []),
    [payload, idsKey],
  )

  return { myState, setBusy, setAvailable, setInvisible, friendsPresence, goOffline }
}

/**
 * For chat windows. Listens to the presence channel but NEVER calls track().
 * A presence entry exists only for clients that track, so a chat window adds
 * none and the user keeps exactly one entry, owned by the Buddy List window.
 */
export function useFriendPresence(friendId: string): PresenceState {
  const [payload, setPayload] = useState<PresencePayload>({})

  useEffect(() => {
    const conn = openPresence({ onPayload: setPayload })
    return () => {
      void conn.close()
    }
  }, [])

  return useMemo(() => mergePresence(payload, [friendId])[friendId] ?? "offline", [payload, friendId])
}
