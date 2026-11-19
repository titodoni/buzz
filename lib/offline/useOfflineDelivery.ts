"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { planDelivery } from "@/lib/offline/delivery"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { closeChannel, openChannel } from "@/lib/realtime/channel"
import { getSupabase } from "@/lib/supabase/browser-client"

export interface OfflineDelivery {
  unreadBySender: Record<string, number>
}

interface InsertedRow {
  id: string
  sender_id: string
  read_at: string | null
}

/** Realtime payloads are untyped, so check the shape before use. */
function isInsertedRow(v: unknown): v is InsertedRow {
  if (typeof v !== "object" || v === null) return false
  const r = v as Record<string, unknown> // narrowing an unknown object to read its fields
  return typeof r.id === "string" && typeof r.sender_id === "string"
}

function readMarker(v: unknown): { id: string; read_at: string | null } | null {
  if (typeof v !== "object" || v === null) return null
  const r = v as Record<string, unknown> // narrowing an unknown object to read its fields
  if (typeof r.id !== "string") return null
  return { id: r.id, read_at: typeof r.read_at === "string" ? r.read_at : null }
}

/**
 * Messages waiting for me (Req 9). Loads unread messages on mount and on
 * window focus, marks them delivered, and keeps the counts live.
 * Display order is by created_at, not delivered_at, so stamping a live row
 * later than its neighbours never reorders a conversation.
 */
export function useOfflineDelivery(me: string): OfflineDelivery {
  const [unreadBySender, setUnread] = useState<Record<string, number>>({})
  const unreadRef = useRef<Map<string, string>>(new Map()) // message id -> sender id

  const publish = useCallback(() => {
    const counts: Record<string, number> = {}
    for (const sender of unreadRef.current.values()) counts[sender] = (counts[sender] ?? 0) + 1
    setUnread(counts)
  }, [])

  const load = useCallback(async () => {
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, created_at, delivered_at")
        .eq("receiver_id", me)
        .is("read_at", null)
        .order("created_at", { ascending: true })
      if (error || !data) return
      const plan = planDelivery(data)
      unreadRef.current = new Map(plan.ordered.map((m) => [m.id, m.sender_id]))
      publish()
      const undelivered = data.filter((m) => m.delivered_at === null).map((m) => m.id)
      if (undelivered.length === 0) return
      // If this fails the rows stay undelivered and are retried next time (Req 9.5).
      await supabase
        .from("messages")
        .update({ delivered_at: new Date().toISOString() })
        .in("id", undelivered)
        .is("delivered_at", null)
    } catch {
      // Keep going; the next refresh retries.
    }
  }, [me, publish])

  useEffect(() => {
    const first = setTimeout(() => void load(), 0)
    const onFocus = () => void load()
    window.addEventListener("focus", onFocus)

    const supabase = getSupabase()
    const filter = `receiver_id=eq.${me}`
    const topic = `offline:${me}`
    let cancelled = false
    let opened: RealtimeChannel | null = null
    // Open after any earlier removal of this topic has finished (dev double-mount).
    void (async () => {
      const channel = await openChannel(topic, undefined, () => cancelled)
      if (!channel) return
      opened = channel
      channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter }, (p) => {
        const row: unknown = p.new
        if (!isInsertedRow(row) || row.read_at) return
        unreadRef.current.set(row.id, row.sender_id)
        publish()
        // The Buddy List is open, so the message is delivered now (Req 9.1, 9.2).
        // Only where delivered_at is null, as the receipt trigger requires.
        // A failure is ignored; the next load retries (Req 9.5).
        void Promise.resolve(
          supabase
            .from("messages")
            .update({ delivered_at: new Date().toISOString() })
            .eq("id", row.id)
            .is("delivered_at", null),
        ).catch(() => undefined)
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter }, (p) => {
        const row = readMarker(p.new)
        if (!row || !row.read_at) return
        if (unreadRef.current.delete(row.id)) publish()
      })
      .subscribe()
    })()

    return () => {
      cancelled = true
      clearTimeout(first)
      window.removeEventListener("focus", onFocus)
      if (opened) void closeChannel(topic, opened)
    }
  }, [me, load, publish])

  return { unreadBySender }
}
