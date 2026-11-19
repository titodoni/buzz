import type { PresenceState } from "../presence/state"

/**
 * Shows the people who ignore me as Offline (Req 15.5). Presence travels on a
 * public channel, so the database can't hide it; the ignored person's own app
 * does (docs/adr/0009).
 */
export function hideIgnorers(
  presence: Record<string, PresenceState>,
  ignorers: ReadonlySet<string>,
): Record<string, PresenceState> {
  if (ignorers.size === 0) return presence
  const out: Record<string, PresenceState> = {}
  for (const [id, state] of Object.entries(presence)) out[id] = ignorers.has(id) ? "offline" : state
  return out
}
