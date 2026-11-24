/** One Nudge I received: who sent it and when it arrived here (ms). */
export interface RecentNudge {
  senderId: string
  receivedAt: number
}

/** The panel shows the last 10 (buzz-trigger R4.3). */
export const RECENT_NUDGES_MAX = 10
/** What the panel says when there is nothing to show. */
export const RECENT_NUDGES_EMPTY = "No Nudges yet. Nudge a friend first."

/** Adds a received Nudge. Newest first, at most 10. */
export function addRecent(list: readonly RecentNudge[], nudge: RecentNudge): RecentNudge[] {
  return [nudge, ...list].slice(0, RECENT_NUDGES_MAX)
}

function isRecentNudge(v: unknown): v is RecentNudge {
  if (typeof v !== "object" || v === null) return false
  const r = v as Record<string, unknown>
  return typeof r.senderId === "string" && r.senderId !== "" && typeof r.receivedAt === "number" && Number.isFinite(r.receivedAt)
}

/**
 * Reads the list saved in localStorage. Missing or damaged values give an
 * empty list, entries of the wrong shape are dropped, and a time in the
 * future (a clock change) counts as now. The log is local, not a secure record (R4.6).
 */
export function readRecent(raw: string | null, now: number): RecentNudge[] {
  if (raw === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter(isRecentNudge)
    .map((n) => ({ senderId: n.senderId, receivedAt: Math.min(n.receivedAt, now) }))
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .slice(0, RECENT_NUDGES_MAX)
}

/** "just now", "3 min ago", "2 h ago", "4 d ago". */
export function agoText(receivedAt: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - receivedAt) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}

/** Red counts on Buddy List rows, per friend: Nudges whose Chat Window could not take focus (R4.2). */
export type NudgeBadges = Readonly<Record<string, number>>

export function addBadge(badges: NudgeBadges, senderId: string): Record<string, number> {
  return { ...badges, [senderId]: (badges[senderId] ?? 0) + 1 }
}

export function clearBadge(badges: NudgeBadges, senderId: string): Record<string, number> {
  const rest = { ...badges }
  delete rest[senderId]
  return rest
}
