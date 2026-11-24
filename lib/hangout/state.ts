import type { PresenceState } from "@/lib/presence/state"

export type HangoutStatus = "pending" | "accepted" | "declined" | "expired"

/** A Hangout nobody answered within this time has expired (buzz-trigger R3.5). */
export const HANGOUT_EXPIRY_MS = 15 * 60_000

/**
 * The status to show. The database job that marks rows expired runs once a
 * minute, so a pending row older than 15 minutes already counts as expired.
 */
export function effectiveStatus(
  row: { status: HangoutStatus; created_at: string },
  now: number,
): HangoutStatus {
  if (row.status !== "pending") return row.status
  return now - Date.parse(row.created_at) >= HANGOUT_EXPIRY_MS ? "expired" : "pending"
}

export type SendBlockReason = "offline" | "pending"

/** Why the Hangout button cannot be used, or null when it can (R3.6, R3.8). */
export function sendBlockReason(
  friendPresence: PresenceState,
  hasPending: boolean,
): SendBlockReason | null {
  if (friendPresence === "offline") return "offline"
  if (hasPending) return "pending"
  return null
}

export interface HangoutRow {
  status: HangoutStatus
  sender_id: string
  receiver_id: string
  text: string
  created_at: string
}

/**
 * The system line one person sees for a Hangout, or null for none (R3.3 to R3.5).
 * System lines are drawn from the row and never stored as messages.
 * `names` maps a user id to a Display Name.
 */
export function systemLine(
  row: HangoutRow,
  viewerId: string,
  names: Record<string, string | undefined>,
  now: number,
): string | null {
  switch (effectiveStatus(row, now)) {
    case "pending":
      return null
    case "accepted":
      return `${names[row.receiver_id] ?? "Your friend"} accepted: ${row.text}`
    case "declined":
      // The receiver just sees the banner go away.
      return viewerId === row.sender_id ? "Hangout declined" : null
    case "expired":
      return "Hangout expired"
  }
}

/** Shown to the sender when the friend is Busy; the Hangout is still sent (R3.7). */
export function busyHint(friendPresence: PresenceState): string | null {
  return friendPresence === "busy" ? "Your friend is busy" : null
}

/** Hangouts sent to `me` that are still waiting, newest first (the banner, R3.2). */
export function incomingPending<T extends HangoutRow>(rows: readonly T[], me: string, now: number): T[] {
  return rows
    .filter((r) => r.receiver_id === me && effectiveStatus(r, now) === "pending")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}

/** True when a Hangout between `me` and `friendId` is waiting, in either direction (R3.6). */
export function hasPendingWith(rows: readonly HangoutRow[], me: string, friendId: string, now: number): boolean {
  return rows.some(
    (r) =>
      effectiveStatus(r, now) === "pending" &&
      ((r.sender_id === me && r.receiver_id === friendId) || (r.sender_id === friendId && r.receiver_id === me)),
  )
}

/** The system lines for one Chat Window, oldest first (R3.3 to R3.5). */
export function chatLines<T extends HangoutRow & { id: string }>(
  rows: readonly T[],
  me: string,
  friendId: string,
  names: Record<string, string | undefined>,
  now: number,
): { id: string; text: string }[] {
  return rows
    .filter(
      (r) =>
        (r.sender_id === me && r.receiver_id === friendId) || (r.sender_id === friendId && r.receiver_id === me),
    )
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .flatMap((r) => {
      const text = systemLine(r, me, names, now)
      return text === null ? [] : [{ id: r.id, text }]
    })
}
