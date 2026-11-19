/**
 * Minimum gap between `typing` broadcasts while someone keeps typing. It is
 * well under TYPING_IDLE_MS (3 s), so the friend's indicator stays lit.
 */
export const TYPING_BROADCAST_MS = 1_000;

/**
 * Decides whether a keystroke should send a `typing` broadcast: the first
 * keystroke always does, then at most once per TYPING_BROADCAST_MS.
 */
export function shouldBroadcastTyping(lastSentAt: number | null, now: number): boolean {
  return lastSentAt === null || now - lastSentAt >= TYPING_BROADCAST_MS;
}
