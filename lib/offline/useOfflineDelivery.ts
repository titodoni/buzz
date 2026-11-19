"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { planDelivery } from "@/lib/offline/delivery"
import { getSupabase } from "@/lib/supabase/browser-client"

export interface OfflineDelivery {
  unreadBySender: Record<string, number>
  refresh(): void
}

/**
 * Messages waiting for me (Req 9). Loads unread messages on mount and on
 * window focus, marks them delivered, and keeps the counts live.
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
    const channel = supabase
      .channel(`offline:${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter }, (p) => {
        const row = p.new as { id?: string; sender_id?: string; read_at?: string | null }
        if (!row.id || !row.sender_id || row.read_at) return
        unreadRef.current.set(row.id, row.sender_id)
        publish()
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter }, (p) => {
        const row = p.new as { id?: string; read_at?: string | null }
        if (!row.id || !row.read_at) return
        if (unreadRef.current.delete(row.id)) publish()
      })
      .subscribe()

    return () => {
      clearTimeout(first)
      window.removeEventListener("focus", onFocus)
      void supabase.removeChannel(channel)
    }
  }, [me, load, publish])

  const refresh = useCallback(() => void load(), [load])
  return { unreadBySender, refresh }
}
