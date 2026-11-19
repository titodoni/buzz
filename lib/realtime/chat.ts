"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { getSupabase } from "@/lib/supabase/browser-client"
import { pairKey } from "@/lib/friends/search"
import type { MessageRow } from "@/lib/chat/conversation"

export type ChatChannelStatus = "connecting" | "connected" | "reconnecting"

export interface ChatChannelOptions {
  me: string
  friendId: string
  onMessage: (message: MessageRow) => void
  /** The friend started or kept typing; `at` is the local receive time (ms). */
  onTyping: (at: number) => void
  onBuzz: () => void
  /** Called after a reconnect so the caller can reload history. */
  onReconnect?: () => void
}

export const RECONNECT_DELAYS_MS: readonly number[] = [1000, 2000, 5000, 10000]

function isMessageRow(v: unknown): v is MessageRow & { receiver_id: string } {
  if (typeof v !== "object" || v === null) return false
  const r = v as Record<string, unknown>
  return (
    typeof r.id === "string" &&
    typeof r.sender_id === "string" &&
    typeof r.receiver_id === "string" &&
    typeof r.body === "string" &&
    typeof r.created_at === "string"
  )
}

function senderOf(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null
  const s = (payload as Record<string, unknown>).sender
  return typeof s === "string" ? s : null
}

/**
 * One Realtime channel per chat window: new messages from the friend
 * (postgres_changes), plus `typing` and `nudge` broadcasts. Presence is not
 * joined here; the Buddy List window owns it.
 */
export function useChatChannel(options: ChatChannelOptions): {
  sendTyping: () => void
  sendBuzz: () => Promise<boolean>
  status: ChatChannelStatus
} {
  const { me, friendId } = options
  const handlers = useRef(options)
  useEffect(() => {
    handlers.current = options
  })
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [status, setStatus] = useState<ChatChannelStatus>("connecting")

  useEffect(() => {
    let active = true
    let attempt = 0
    let hasConnected = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const supabase = getSupabase()

    const connect = () => {
      if (!active) return
      const channel = supabase.channel(`chat:${pairKey(me, friendId)}`, {
        config: { broadcast: { ack: true, self: false } },
      })
      channelRef.current = channel
      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${me}` },
          (payload) => {
            const row: unknown = payload.new
            if (isMessageRow(row) && row.sender_id === friendId) handlers.current.onMessage(row)
          },
        )
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if (senderOf(payload) === friendId) handlers.current.onTyping(Date.now())
        })
        .on("broadcast", { event: "nudge" }, ({ payload }) => {
          if (senderOf(payload) === friendId) handlers.current.onBuzz()
        })
        .subscribe((s) => {
          if (!active || channelRef.current !== channel) return
          if (s === "SUBSCRIBED") {
            attempt = 0
            setStatus("connected")
            // Messages are the source of truth: catch up after a drop.
            if (hasConnected) handlers.current.onReconnect?.()
            hasConnected = true
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
            setStatus("reconnecting")
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

  const sendTyping = useCallback(() => {
    void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { sender: me } })
  }, [me])

  const sendBuzz = useCallback(async () => {
    const ch = channelRef.current
    if (!ch) return false
    try {
      const res = await ch.send({ type: "broadcast", event: "nudge", payload: { sender: me } })
      return res === "ok"
    } catch {
      return false
    }
  }, [me])

  return { sendTyping, sendBuzz, status }
}
