"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { closeChannel, openChannel } from "@/lib/realtime/channel"
import { getSupabase } from "@/lib/supabase/browser-client"
import type { Database } from "@/lib/supabase/database.types"
import { useProfileUpdates } from "./profileFeed"
import { mergeProfile } from "./profileMerge"
import { requestErrorMessage } from "./requestErrors"
import { canSendRequest, MAX_SEARCH_RESULTS } from "./search"

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"]

export type ApiResult = { ok: boolean; message?: string }

export interface PublicProfile {
  id: string
  displayName: string
  avatarUrl: string | null
  statusMessage: string | null
  nowPlaying: string | null
}

/** An accepted friend, joined with their profile. */
export interface FriendEntry extends PublicProfile {
  friendshipId: string
}

/** A pending request, joined with the other person's profile. */
export interface RequestEntry extends PublicProfile {
  friendshipId: string
}

const GENERIC = "Something went wrong. Please try again."


function toProfile(p: ProfileRow): PublicProfile {
  return {
    id: p.id,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
    statusMessage: p.status_message,
    nowPlaying: p.now_playing,
  }
}

function unknownProfile(id: string): PublicProfile {
  return { id, displayName: "Someone", avatarUrl: null, statusMessage: null, nowPlaying: null }
}

/** All pending/accepted friendship rows that involve `me` (RLS limits rows to the caller anyway). */
export async function listFriendships(me: string): Promise<FriendshipRow[]> {
  const { data, error } = await getSupabase()
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
    .in("status", ["pending", "accepted"])
  if (error) throw error
  return data ?? []
}

export async function getProfile(id: string): Promise<PublicProfile | null> {
  const { data, error } = await getSupabase().from("profiles").select("*").eq("id", id).maybeSingle()
  if (error) throw error
  return data ? toProfile(data) : null
}

async function getProfiles(ids: string[]): Promise<Map<string, PublicProfile>> {
  const map = new Map<string, PublicProfile>()
  if (ids.length === 0) return map
  const { data, error } = await getSupabase().from("profiles").select("*").in("id", ids)
  if (error) throw error
  for (const p of data ?? []) map.set(p.id, toProfile(p))
  return map
}

/**
 * Finds people by display name (case-insensitive contains) or by exact email,
 * via the `search_users` database function (max 20, never you; names need 3+ letters). Emails stay in
 * auth.users and are never returned; exact-only email matching is a privacy
 * choice so nobody can probe for addresses.
 */
export async function searchProfiles(query: string, me: string): Promise<PublicProfile[]> {
  const q = query.trim()
  if (q === "") return []
  const { data, error } = await getSupabase().rpc("search_users", { q })
  if (error) throw error
  return (data ?? [])
    .filter((p) => p.id !== me)
    .slice(0, MAX_SEARCH_RESULTS)
    .map((p) => ({
      id: p.id,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      statusMessage: p.status_message,
      nowPlaying: p.now_playing,
    }))
}

/**
 * Sends a friend request. Reuses an existing declined/removed row by setting it
 * back to pending with me as the requester; otherwise inserts a new row.
 */
export async function sendFriendRequest(me: string, them: string): Promise<ApiResult> {
  try {
    const supabase = getSupabase()
    const { data: rows, error: findError } = await supabase
      .from("friendships")
      .select("*")
      .or(
        `and(requester_id.eq.${me},addressee_id.eq.${them}),and(requester_id.eq.${them},addressee_id.eq.${me})`,
      )
      .limit(1)
    if (findError) return { ok: false, message: GENERIC }
    const existing = rows?.[0] ?? null

    const gate = canSendRequest(existing, me, them)
    if (!gate.ok) {
      if (existing?.status === "pending" && existing.requester_id === them) {
        return { ok: false, message: "They already sent you a request. Accept it below!" }
      }
      return { ok: false, message: gate.reason ?? GENERIC }
    }

    if (existing) {
      // Re-open a declined/removed pair with me as the requester (either person may do this).
      const { error } = await supabase
        .from("friendships")
        .update({ status: "pending", requester_id: me, addressee_id: them })
        .eq("id", existing.id)
      if (error) return { ok: false, message: requestErrorMessage(error) }
      return { ok: true, message: "Request sent!" }
    }

    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: me, addressee_id: them, status: "pending" })
    if (error) return { ok: false, message: requestErrorMessage(error) }
    return { ok: true, message: "Request sent!" }
  } catch {
    return { ok: false, message: GENERIC }
  }
}

async function setStatus(
  id: string,
  status: "accepted" | "declined" | "removed",
  okMessage: string,
): Promise<ApiResult> {
  try {
    const { data, error } = await getSupabase().from("friendships").update({ status }).eq("id", id).select("id")
    if (error || !data || data.length === 0) return { ok: false, message: GENERIC }
    return { ok: true, message: okMessage }
  } catch {
    return { ok: false, message: GENERIC }
  }
}

export const acceptRequest = (id: string) => setStatus(id, "accepted", "You're now friends!")
export const declineRequest = (id: string) => setStatus(id, "declined", "Request declined.")
export const removeFriend = (id: string) => setStatus(id, "removed", "Friend removed.")

export interface FriendsData {
  friends: FriendEntry[]
  incoming: RequestEntry[]
  outgoing: RequestEntry[]
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Loads friendships plus the other person's profile, and refreshes when
 * friendships change (two postgres_changes filters: requester_id and
 * addressee_id equal to me). The channel is removed on unmount.
 */
export function useFriends(me: string): FriendsData {
  const [data, setData] = useState<Pick<FriendsData, "friends" | "incoming" | "outgoing">>({
    friends: [],
    incoming: [],
    outgoing: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const rows = await listFriendships(me)
        const otherId = (r: FriendshipRow) => (r.requester_id === me ? r.addressee_id : r.requester_id)
        const profiles = await getProfiles(rows.map(otherId))
        if (!active) return
        const entry = (r: FriendshipRow) => ({
          ...(profiles.get(otherId(r)) ?? unknownProfile(otherId(r))),
          friendshipId: r.id,
        })
        setData({
          friends: rows.filter((r) => r.status === "accepted").map(entry),
          incoming: rows.filter((r) => r.status === "pending" && r.addressee_id === me).map(entry),
          outgoing: rows.filter((r) => r.status === "pending" && r.requester_id === me).map(entry),
        })
        setError(null)
      } catch {
        if (active) setError("We couldn't load your friends. Please try again.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [me, tick])

  useEffect(() => {
    try {
      getSupabase() // throws when Supabase isn't configured; then there is nothing to subscribe to
    } catch {
      return
    }
    const topic = `friendships:${me}`
    let cancelled = false
    let opened: RealtimeChannel | null = null
    void (async () => {
      const channel = await openChannel(topic, undefined, () => cancelled)
      if (!channel) return
      opened = channel
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "friendships", filter: `requester_id=eq.${me}` },
          reload,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${me}` },
          reload,
        )
        .subscribe()
    })()
    return () => {
      cancelled = true
      if (opened) void closeChannel(topic, opened)
    }
  }, [me, reload])

  // A friend's new Status, Now Playing, name, or Avatar shows without a reload (buzz-trigger R0).
  const friendIds = useMemo(() => data.friends.map((f) => f.id), [data.friends])
  const onProfile = useCallback(
    (p: PublicProfile) => setData((d) => {
      const friends = mergeProfile(d.friends, p)
      return friends === d.friends ? d : { ...d, friends }
    }),
    [],
  )
  useProfileUpdates(`profiles:buddylist:${me}`, friendIds, onProfile)

  return { ...data, loading, error, reload }
}
