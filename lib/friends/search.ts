/** Hard cap on search results (Req 3.1). */
/** Matches the limit in search_users (migration 20261124124350). */
export const MAX_SEARCH_RESULTS = 20;

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

export type SearchResultRelation =
  | { kind: "friend" }
  | { kind: "incoming"; friendshipId: string }
  | { kind: "outgoing"; friendshipId?: string }
  | { kind: "none" };

/**
 * Classifies a user appearing in friend-search results against the caller's
 * current friend/request state so the search row can offer Accept/Decline or
 * show Waiting.../Friend instead of a failing Add button.
 */
export function searchResultRelation(
  userId: string,
  lists: {
    friends: readonly { id: string }[];
    incoming: readonly { id: string; friendshipId: string }[];
    outgoing: readonly { id: string; friendshipId: string }[];
  },
  justSentIds?: ReadonlySet<string>,
): SearchResultRelation {
  if (lists.friends.some((f) => f.id === userId)) return { kind: "friend" };
  const inc = lists.incoming.find((r) => r.id === userId);
  if (inc) return { kind: "incoming", friendshipId: inc.friendshipId };
  const out = lists.outgoing.find((r) => r.id === userId);
  if (out) return { kind: "outgoing", friendshipId: out.friendshipId };
  if (justSentIds?.has(userId)) return { kind: "outgoing" };
  return { kind: "none" };
}
