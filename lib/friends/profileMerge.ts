import type { Database } from "../supabase/database.types"

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]

/** The fields friends can see. Same shape as `PublicProfile` in ./api. */
export interface ProfileFields {
  id: string
  displayName: string
  avatarUrl: string | null
  statusMessage: string | null
  nowPlaying: string | null
}

/** Realtime accepts at most 100 values in one `in` filter. */
export const PROFILE_FILTER_MAX = 100

/** Splits ids into `in` filters Realtime accepts, sorted so the same set gives the same filters. */
export function profileFilters(ids: readonly string[]): string[] {
  const sorted = [...new Set(ids)].sort()
  const out: string[] = []
  for (let i = 0; i < sorted.length; i += PROFILE_FILTER_MAX) {
    out.push(`id=in.(${sorted.slice(i, i + PROFILE_FILTER_MAX).join(",")})`)
  }
  return out
}

/** The public fields of a profile row, as the app uses them. */
export function profileFromRow(row: ProfileRow): ProfileFields {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    statusMessage: row.status_message,
    nowPlaying: row.now_playing,
  }
}

const sameFields = (a: ProfileFields, b: ProfileFields) =>
  a.displayName === b.displayName &&
  a.avatarUrl === b.avatarUrl &&
  a.statusMessage === b.statusMessage &&
  a.nowPlaying === b.nowPlaying

/**
 * Replaces the public fields of the entry whose id matches, keeping any
 * extra fields (such as friendshipId). Returns the same array when nothing
 * changed, so React skips the re-render.
 */
export function mergeProfile<T extends ProfileFields>(list: T[], update: ProfileFields): T[] {
  const i = list.findIndex((x) => x.id === update.id)
  if (i < 0 || sameFields(list[i], update)) return list
  const next = [...list]
  next[i] = { ...list[i], ...update }
  return next
}

/** Same as mergeProfile for a single profile; ignores updates for anyone else. */
export function mergeOne<T extends ProfileFields>(cur: T | null, update: ProfileFields): T | null {
  if (!cur || cur.id !== update.id || sameFields(cur, update)) return cur
  return { ...cur, ...update }
}
