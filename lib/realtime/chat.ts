"use client"

import { useCallback, useEffect, useRef } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { getSupabase } from "@/lib/supabase/browser-client"
import { pairKey } from "@/lib/friends/search"
import type { MessageRow } from "@/lib/chat/conversation"
import type { TypingSignal } from "@/lib/typing/broadcast"

export interface ChatChannelOptions {
  me: string
  friendId: string
  onMessage: (message: MessageRow) => void
  /** A typing broadcast from the friend; `at` is the local receive time (ms). */
  onTyping: (signal: TypingSignal, at: number) => void
  onNudge: () => void
  /** Called after a reconnect so the caller can reload history. */
  onReconnect?: () => void
}

export const RECONNECT_DELAYS_MS: readonly number[] = [1000, 2000, 5000, 10000]

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

function isMessageRow(v: unknown): v is MessageRow {
  if (!isRecord(v)) return false
  const r = v
  return (
    typeof r.id === "string" &&
    typeof r.sender_id === "string" &&
    typeof r.receiver_id === "string" &&
    typeof r.body === "string" &&
    typeof r.created_at === "string"
  )
}

function senderOf(payload: unknown): string | null {
  if (!isRecord(payload)) return null
  return typeof payload.sender === "string" ? payload.sender : null
}

/** A missing or malformed `stopped` counts as still typing. */
function stoppedOf(payload: unknown): boolean {
  return isRecord(payload) && payload.stopped === true
}

/**
 * One Realtime channel per chat window: new messages from the friend
 * (postgres_changes), plus `typing` and `nudge` broadcasts. Presence is not
 * joined here; the Buddy List window owns it.
 */
export function useChatChannel(options: ChatChannelOptions): {
  /** `stopped: true` is sent once right after a message, to clear the indicator. */
  sendTyping: (stopped: boolean) => void
  sendNudge: () => Promise<boolean>
} {
  const { me, friendId } = options
  const handlers = useRef(options)
  useEffect(() => {
    handlers.current = options
  })
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    let active = true
    let attempt = 0
    let hasConnected = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const supabase = getSupabase()

    const connect = () => {
      if (!active) return
      const channel = supabase.channel(`chat:${pairKey(me, friendId)}`, {
        config: { private: true, broadcast: { ack: true, self: false } },
      })
      channelRef.current = channel
      // Two listeners, because a filter takes one column: messages to me, and
      // my own sends from another instance. Only rows of this pair are kept;
      // the conversation reducer dedupes by id.
      const onInsert = (payload: { new: unknown }) => {
        const row = payload.new
        if (!isMessageRow(row)) return
        const fromFriend = row.sender_id === friendId && row.receiver_id === me
        const fromMe = row.sender_id === me && row.receiver_id === friendId
        if (fromFriend || fromMe) handlers.current.onMessage(row)
      }
      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${me}` },
          onInsert,
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${me}` },
          onInsert,
        )
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if (senderOf(payload) === friendId) {
            handlers.current.onTyping({ stopped: stoppedOf(payload) }, Date.now())
          }
        })
        .on("broadcast", { event: "nudge" }, ({ payload }) => {
          if (senderOf(payload) === friendId) handlers.current.onNudge()
        })
        .subscribe((s) => {
          if (!active || channelRef.current !== channel) return
          if (s === "SUBSCRIBED") {
            attempt = 0
            // Messages are the source of truth: catch up after a drop.
            if (hasConnected) handlers.current.onReconnect?.()
            hasConnected = true
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
            channelRef.current = null
            void supabase.removeChannel(channel)
            const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)]
            attempt += 1
            hasConnected = true // the next successful subscribe is a reconnect
            timer = setTimeout(connect, delay)
          }
        })
    }

    connect()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
      const ch = channelRef.current
      channelRef.current = null
      if (ch) void supabase.removeChannel(ch)
    }
  }, [me, friendId])

  const sendTyping = useCallback(
    (stopped: boolean) => {
      void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { sender: me, stopped } })
    },
    [me],
  )

  const sendNudge = useCallback(async () => {
    const ch = channelRef.current
    if (!ch) return false
    try {
      const res = await ch.send({ type: "broadcast", event: "nudge", payload: { sender: me } })
      return res === "ok"
    } catch {
      return false
    }
  }, [me])

  return { sendTyping, sendNudge }
}
