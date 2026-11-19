export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** True iff undelivered and created_at > now - 30 days (strict). `now` is epoch ms. */
export function shouldRetain<M extends { delivered_at: string | null; created_at: string }>(
  m: M,
  now: number,
): boolean {
  return m.delivered_at === null && Date.parse(m.created_at) > now - RETENTION_MS;
}

/** Ascending created_at; stable for ties; returns a new array. */
export function orderOfflineMessages<M extends { created_at: string }>(messages: M[]): M[] {
  return messages
    .map((m) => ({ m, t: Date.parse(m.created_at) }))
    .sort((a, b) => a.t - b.t)
    .map((x) => x.m);
}
