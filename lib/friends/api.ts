"use client"

import { useCallback, useEffect, useState } from "react"
import { getSupabase } from "@/lib/supabase/browser-client"
import type { Database } from "@/lib/supabase/database.types"
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
 * via the `search_users` database function (max 50, never you). Emails stay in
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
      if (error) return { ok: false, message: GENERIC }
      return { ok: true, message: "Request sent!" }
    }

    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: me, addressee_id: them, status: "pending" })
    if (error) return { ok: false, message: GENERIC }
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
    let supabase: ReturnType<typeof getSupabase>
    try {
      supabase = getSupabase()
    } catch {
      return
    }
    const channel = supabase
      .channel(`friendships:${me}`)
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
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [me, reload])

  return { ...data, loading, error, reload }
}
