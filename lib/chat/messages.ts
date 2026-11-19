export const DEFAULT_MESSAGE_LIMIT = 50;

/**
 * The `limit` messages with the greatest created_at (ISO timestamps, parsed),
 * ordered oldest-first. Ties keep input order. Returns all when |all| <= limit.
 * Does not mutate the input.
 */
export function loadRecentMessages<M extends { created_at: string }>(
  all: M[],
  limit: number = DEFAULT_MESSAGE_LIMIT,
): M[] {
  const n = Math.max(0, Math.floor(limit));
  if (n === 0) return [];
  const sorted = all
    .map((m) => ({ m, t: Date.parse(m.created_at) }))
    .sort((a, b) => a.t - b.t) // stable
    .map((x) => x.m);
  return sorted.slice(Math.max(0, sorted.length - n));
}

/** True iff the message has not been delivered. */
export function isOfflineMessage<M extends { delivered_at: string | null }>(m: M): boolean {
  return m.delivered_at === null;
}
