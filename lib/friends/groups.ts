"use client"
import { useCallback, useEffect, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { closeChannel, openChannel } from "@/lib/realtime/channel"
import { getSupabase } from "@/lib/supabase/browser-client"
import { groupNameError } from "./groupName"

export interface ContactGroup {
  id: string
  name: string
  position: number
}

export interface GroupMembership {
  friendId: string
  groupId: string
}

export type GroupResult = { ok: true } | { ok: false; message: string }

const MSG_FAILED = "That didn't work. Please try again."

/** Loads my groups and memberships, and reloads after every change made here. */
export function useGroups(me: string): {
  groups: ContactGroup[]
  memberships: GroupMembership[]
  reload: () => void
} {
  const [groups, setGroups] = useState<ContactGroup[]>([])
  const [memberships, setMemberships] = useState<GroupMembership[]>([])
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const supabase = getSupabase()
        const [g, m] = await Promise.all([
          supabase.from("contact_groups").select("id, name, position").eq("owner_id", me).order("position"),
          supabase.from("contact_group_members").select("friend_id, group_id").eq("owner_id", me),
        ])
        if (!active || g.error || m.error) return
        setGroups(g.data)
        setMemberships(m.data.map((r) => ({ friendId: r.friend_id, groupId: r.group_id })))
      } catch {
        // Not configured or offline: everyone stays in the default group.
      }
    })()
    return () => {
      active = false
    }
  }, [me, tick])

  // Changes made in my other app instances arrive live (rows are RLS-filtered to me).
  useEffect(() => {
    if (!me) return
    const topic = `groups:${me}`
    let cancelled = false
    let opened: RealtimeChannel | null = null
    void (async () => {
      const channel = await openChannel(topic, undefined, () => cancelled)
      if (!channel) return
      opened = channel
      const filter = `owner_id=eq.${me}`
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "contact_groups", filter }, reload)
        .on("postgres_changes", { event: "*", schema: "public", table: "contact_group_members", filter }, reload)
        // Changes made while the socket was down are not replayed: load again on (re)join.
        .subscribe((status) => {
          if (status === "SUBSCRIBED") reload()
        })
    })()
    return () => {
      cancelled = true
      if (opened) void closeChannel(topic, opened)
    }
  }, [me, reload])

  return { groups, memberships, reload }
}

/** Postgres unique-violation code: a group with that name appeared meanwhile. */
const UNIQUE_VIOLATION = "23505"

export async function createGroup(me: string, name: string, existing: readonly ContactGroup[]): Promise<GroupResult> {
  const problem = groupNameError(name, existing.map((g) => g.name))
  if (problem) return { ok: false, message: problem }
  const position = existing.reduce((max, g) => Math.max(max, g.position), 0) + 1
  const { error } = await getSupabase()
    .from("contact_groups")
    .insert({ owner_id: me, name: name.trim(), position })
  if (error?.code === UNIQUE_VIOLATION) return { ok: false, message: `You already have a group called "${name.trim()}".` }
  return error ? { ok: false, message: MSG_FAILED } : { ok: true }
}

export async function renameGroup(group: ContactGroup, name: string, existing: readonly ContactGroup[]): Promise<GroupResult> {
  const problem = groupNameError(
    name,
    existing.map((g) => g.name),
    group.name,
  )
  if (problem) return { ok: false, message: problem }
  const { error } = await getSupabase().from("contact_groups").update({ name: name.trim() }).eq("id", group.id)
  if (error?.code === UNIQUE_VIOLATION) return { ok: false, message: `You already have a group called "${name.trim()}".` }
  return error ? { ok: false, message: MSG_FAILED } : { ok: true }
}

/** Deletes a group; its friends go back to the default group (Req 14.3). */
export async function deleteGroup(groupId: string): Promise<GroupResult> {
  const { error } = await getSupabase().from("contact_groups").delete().eq("id", groupId)
  return error ? { ok: false, message: MSG_FAILED } : { ok: true }
}

/** Puts a friend in one of my groups, or back in the default group with `groupId` null (Req 14.4). */
export async function moveFriend(me: string, friendId: string, groupId: string | null): Promise<GroupResult> {
  const table = getSupabase().from("contact_group_members")
  const { error } =
    groupId === null
      ? await table.delete().eq("owner_id", me).eq("friend_id", friendId)
      : await table.upsert({ owner_id: me, friend_id: friendId, group_id: groupId }, { onConflict: "owner_id,friend_id" })
  return error ? { ok: false, message: MSG_FAILED } : { ok: true }
}
