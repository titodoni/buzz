"use client"

import { useEffect, useRef } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { closeChannel, openChannel } from "@/lib/realtime/channel"
import { getSupabase } from "@/lib/supabase/browser-client"
import type { Database } from "@/lib/supabase/database.types"
import { profileFilters, profileFromRow, type ProfileFields } from "./profileMerge"

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]

/**
 * Calls `onUpdate` whenever one of `ids` changes their profile
 * (postgres_changes UPDATE on `profiles`, buzz-trigger R0). RLS decides
 * what arrives. `channelName` must be unique per window and purpose.
 */
export function useProfileUpdates(
  channelName: string,
  ids: readonly string[],
  onUpdate: (p: ProfileFields) => void,
): void {
  const handler = useRef(onUpdate)
  useEffect(() => {
    handler.current = onUpdate
  }, [onUpdate])
  const key = profileFilters(ids).join("|")
  const idsRef = useRef(ids)
  useEffect(() => {
    idsRef.current = ids
  }, [ids])

  useEffect(() => {
    if (key === "") return
    let supabase: ReturnType<typeof getSupabase>
    try {
      supabase = getSupabase() // throws when Supabase isn't configured; then there is nothing to subscribe to
    } catch {
      return
    }
    let cancelled = false
    let opened: RealtimeChannel | null = null
    // Realtime does not replay updates made while the socket was down, so read
    // the profiles again whenever the channel (re)joins. Unchanged ones merge to nothing.
    const resync = async () => {
      const { data, error } = await supabase.from("profiles").select("*").in("id", [...idsRef.current])
      if (cancelled || error || !data) return
      for (const row of data) handler.current(profileFromRow(row))
    }
    void (async () => {
      const channel = await openChannel(channelName, undefined, () => cancelled)
      if (!channel) return
      opened = channel
      for (const filter of key.split("|")) {
        channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter }, (payload) => {
          // supabase-js types payload.new loosely; rows from this table are ProfileRow
          handler.current(profileFromRow(payload.new as ProfileRow))
        })
      }
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") void resync().catch(() => undefined)
      })
    })()
    return () => {
      cancelled = true
      if (opened) void closeChannel(channelName, opened)
    }
  }, [channelName, key])
}
