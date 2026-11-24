"use client"

import { useCallback, useEffect, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { closeChannel, openChannel } from "@/lib/realtime/channel"
import { getSupabase } from "@/lib/supabase/browser-client"
import { loadRecentHangouts, toRecord, type HangoutRecord } from "./api"

/** How often the clock for "expired" re-reads. Local only, no network. */
const CLOCK_MS = 15_000

/**
 * My recent Hangouts, kept live. Rows come from `postgres_changes` on
 * `hangouts` (a binding for rows I send and one for rows I receive; RLS lets
 * only the two parties through). Nothing is broadcast, so there is no
 * channel to guard (buzz-trigger R6.3). `channelName` must be unique per
 * window. Returns the rows and `now`, which advances so a Hangout expires on
 * screen without a server round trip.
 */
export function useHangouts(me: string, channelName: string): { rows: HangoutRecord[]; now: number } {
  const [rows, setRows] = useState<HangoutRecord[]>([])
  const [now, setNow] = useState(() => Date.now())

  const upsert = useCallback((rec: HangoutRecord) => {
    setRows((cur) => [rec, ...cur.filter((r) => r.id !== rec.id)])
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), CLOCK_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!me) return
    try {
      getSupabase() // throws when Supabase isn't configured; then there is nothing to load
    } catch {
      return
    }
    let cancelled = false
    let opened: RealtimeChannel | null = null
    const reload = () => {
      loadRecentHangouts()
        .then((list) => {
          if (!cancelled) setRows(list)
        })
        .catch(() => undefined)
    }
    void (async () => {
      const channel = await openChannel(channelName, undefined, () => cancelled)
      if (!channel) return
      opened = channel
      for (const column of ["receiver_id", "sender_id"] as const) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "hangouts", filter: `${column}=eq.${me}` },
          (payload) => {
            // supabase-js types payload.new loosely; a DELETE carries no new row (and none is allowed here).
            const row = payload.new as Parameters<typeof toRecord>[0] | undefined
            if (row && typeof row.id === "string") {
              setNow(Date.now())
              upsert(toRecord(row))
            }
          },
        )
      }
      // Load once subscribed, and again after a reconnect, so missed events recover from Postgres.
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") reload()
      })
    })()
    return () => {
      cancelled = true
      if (opened) void closeChannel(channelName, opened)
    }
  }, [me, channelName, upsert])

  return { rows, now }
}
