import type { PresenceState } from "../presence/state"

/** The group every friend is in until the user moves them (it has no database row). */
export const DEFAULT_GROUP_NAME = "Friends"

export interface ArrangeInput {
  friends: readonly { id: string; displayName: string }[]
  groups: readonly { id: string; name: string; position: number }[]
  memberships: readonly { friendId: string; groupId: string }[]
  presence: Readonly<Record<string, PresenceState>>
  showOffline: boolean
  search: string
}

export interface ArrangedFriend {
  id: string
  displayName: string
  presence: PresenceState
  /** Online friends (Available, Busy, Away) are shown in bold (Req 14.6). */
  bold: boolean
}

export interface ArrangedGroup {
  /** null for the default group. */
  id: string | null
  name: string
  /** Counts always cover the whole group, whatever is filtered (Req 14.1, 14.8). */
  online: number
  total: number
  friends: ArrangedFriend[]
}

const byName = (a: { displayName: string }, b: { displayName: string }) =>
  a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })

/** Builds the Buddy List: groups in order, each with its friends sorted and filtered. */
export function arrangeBuddyList(input: ArrangeInput): ArrangedGroup[] {
  const known = new Set(input.groups.map((g) => g.id))
  const groupOf = new Map<string, string>()
  for (const m of input.memberships) if (known.has(m.groupId)) groupOf.set(m.friendId, m.groupId)

  const ordered = [...input.groups].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
  const buckets = new Map<string | null, ArrangedFriend[]>()
  buckets.set(null, [])
  for (const g of ordered) buckets.set(g.id, [])
  for (const fr of input.friends) {
    const presence = input.presence[fr.id] ?? "offline"
    const entry: ArrangedFriend = { id: fr.id, displayName: fr.displayName, presence, bold: presence !== "offline" }
    buckets.get(groupOf.get(fr.id) ?? null)?.push(entry)
  }

  const term = input.search.trim().toLowerCase()
  const build = (id: string | null, name: string): ArrangedGroup => {
    const all = buckets.get(id) ?? []
    const online = all.filter((x) => x.bold)
    const offline = all.filter((x) => !x.bold)
    let shown = [...online.sort(byName), ...(input.showOffline ? offline.sort(byName) : [])]
    if (term) shown = shown.filter((x) => x.displayName.toLowerCase().includes(term))
    return { id, name, online: online.length, total: all.length, friends: shown }
  }

  const result = [build(null, DEFAULT_GROUP_NAME), ...ordered.map((g) => build(g.id, g.name))]
  if (term) return result.filter((g) => g.friends.length > 0)
  // An empty default group is noise once the user has groups of their own.
  return result.filter((g) => g.id !== null || g.total > 0 || ordered.length === 0)
}
