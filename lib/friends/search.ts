/** Hard cap on search results (Req 3.1). */
export const MAX_SEARCH_RESULTS = 50;

/**
 * Case-insensitive "contains" search on email or display_name.
 * Excludes the searcher. Result size is at most min(limit, 50).
 * An empty or whitespace-only query returns an empty list (no browsing of all users).
 * The query is trimmed before matching.
 */
export function searchUsers<U extends { id: string; email: string; display_name: string }>(
  users: U[],
  query: string,
  selfId: string,
  limit: number = MAX_SEARCH_RESULTS,
): U[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const cap = Math.max(0, Math.min(Math.floor(limit), MAX_SEARCH_RESULTS));
  const out: U[] = [];
  for (const u of users) {
    if (out.length >= cap) break;
    if (u.id === selfId) continue;
    if (u.email.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q)) {
      out.push(u);
    }
  }
  return out;
}

/** Returns [min, max] by plain string comparison. */
export function canonicalPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

/** `${min}_${max}` key for an unordered pair of ids. */
export function pairKey(a: string, b: string): string {
  const [lo, hi] = canonicalPair(a, b);
  return `${lo}_${hi}`;
}

/**
 * A request can be sent when there is no relationship, or it was declined or removed.
 * Not allowed to oneself, or when already accepted or pending.
 */
export function canSendRequest(
  rel: { status: string } | null,
  selfId: string,
  recipientId: string,
): { ok: boolean; reason?: string } {
  if (recipientId === selfId) return { ok: false, reason: "You can't add yourself." };
  if (rel?.status === "accepted") return { ok: false, reason: "You're already friends." };
  if (rel?.status === "pending") return { ok: false, reason: "A request is already pending." };
  return { ok: true };
}
