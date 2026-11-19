"use client"

import type { RealtimeChannel } from "@supabase/supabase-js"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { nextPresenceState, type PresenceEvent, type PresenceState } from "@/lib/presence/state"
import { onRemoteActivity } from "@/lib/realtime/activity"
import { mergePresence, type PresencePayload } from "@/lib/realtime/presenceMerge"
import { getSupabase } from "@/lib/supabase/browser-client"

export const PRESENCE_CHANNEL = "presence:global"

/** Pause before each reconnect attempt; the last value repeats. */
export const RECONNECT_BACKOFF_MS = [1000, 2000, 5000, 10000] as const
const ACTIVITY_THROTTLE_MS = 5000
/** How often the idle check runs. Keeps "away" within 10 s of the 5 min limit (Req 4.2). */
export const IDLE_CHECK_MS = 5000
const ACTIVITY_EVENTS = ["mousemove", "keydown", "mousedown", "focus", "visibilitychange"] as const

type TrackedPayload = { user_id: string; presence_state: PresenceState }

interface Connection {
  /** The live channel, or null while waiting to reconnect. */
  current(): RealtimeChannel | null
  close(): Promise<void>
}

/**
 * Opens the shared presence channel and keeps it open: on CHANNEL_ERROR or
 * TIMED_OUT it removes the channel and tries again after 1s, 2s, 5s, then 10s.
 * `key` is the presence key (the user id) for the tracker; read-only
 * listeners pass nothing and never track.
 */
function openPresence(opts: {
  key?: string
  onPayload: (payload: PresencePayload) => void
  onSubscribed?: (channel: RealtimeChannel) => void
}): Connection {
  let channel: RealtimeChannel | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0
  let closed = false

  const connect = () => {
    if (closed) return
    const ch = getSupabase().channel(
      PRESENCE_CHANNEL,
      opts.key ? { config: { presence: { key: opts.key } } } : undefined,
    )
    channel = ch
    const sync = () => opts.onPayload(ch.presenceState<TrackedPayload>())
    ch.on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (closed || channel !== ch) return
        if (status === "SUBSCRIBED") {
          attempt = 0
          opts.onSubscribed?.(ch)
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          channel = null
          void getSupabase().removeChannel(ch)
          const delay = RECONNECT_BACKOFF_MS[Math.min(attempt, RECONNECT_BACKOFF_MS.length - 1)]
          attempt += 1
          timer = setTimeout(connect, delay)
        }
      })
  }
  connect()

  return {
    current: () => channel,
    async close() {
      closed = true
      if (timer) clearTimeout(timer)
      const ch = channel
      channel = null
      if (!ch) return
      if (opts.key) await ch.untrack().catch(() => undefined)
      await getSupabase().removeChannel(ch)
    },
  }
}

export interface PresenceTracker {
  myState: PresenceState
  setBusy(): void
  setAvailable(): void
  friendsPresence: Record<string, PresenceState>
}

/**
 * Buddy List window ONLY. Tracks my presence and reports my friends' presence.
 * Chat windows must use `useFriendPresence` so one user keeps one presence entry.
 */
export function usePresenceTracker(me: string, friendIds: string[]): PresenceTracker {
  const [myState, setMyState] = useState<PresenceState>("online")
  const [payload, setPayload] = useState<PresencePayload>({})
  const stateRef = useRef<PresenceState>("online")
  const lastActivityRef = useRef<number>(0)
  const lastEmitRef = useRef<number>(0)
  const trackRef = useRef<(() => void) | null>(null)

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
    const track = () => {
      const ch = conn?.current()
      if (!ch) return
      const body: TrackedPayload = { user_id: me, presence_state: stateRef.current }
      void ch.track(body)
    }
    trackRef.current = track
    lastActivityRef.current = Date.now()
    conn = openPresence({
      key: me,
      onPayload: setPayload,
      onSubscribed: () => track(),
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
      stopRemote()
      trackRef.current = null
      void conn?.close()
    }
  }, [me, dispatch])

  const setBusy = useCallback(() => dispatch({ type: "setBusy" }), [dispatch])
  const setAvailable = useCallback(() => {
    lastActivityRef.current = Date.now()
    dispatch({ type: "setOnline" })
  }, [dispatch])

  const idsKey = friendIds.join(",")
  const friendsPresence = useMemo(
    () => mergePresence(payload, idsKey ? idsKey.split(",") : []),
    [payload, idsKey],
  )

  return { myState, setBusy, setAvailable, friendsPresence }
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
