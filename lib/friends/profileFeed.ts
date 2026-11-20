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

  useEffect(() => {
    if (key === "") return
    try {
      getSupabase() // throws when Supabase isn't configured; then there is nothing to subscribe to
    } catch {
      return
    }
    let cancelled = false
    let opened: RealtimeChannel | null = null
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
      channel.subscribe()
    })()
    return () => {
      cancelled = true
      if (opened) void closeChannel(channelName, opened)
    }
  }, [channelName, key])
}
