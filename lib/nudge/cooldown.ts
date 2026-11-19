import type { PresenceState } from "../presence/state";

export interface NudgeCooldown {
  lastNudgeAt: number | null;
}

export const NUDGE_COOLDOWN_MS = 10_000;
export const NUDGE_SHAKE_MS = 600;

export function isInCooldown(s: NudgeCooldown, now: number): boolean {
  return s.lastNudgeAt != null && now - s.lastNudgeAt < NUDGE_COOLDOWN_MS;
}

/** Starts the cooldown only when the nudge was delivered. */
export function onNudgeResult(
  s: NudgeCooldown,
  now: number,
  delivered: boolean,
): NudgeCooldown {
  return delivered ? { lastNudgeAt: now } : s;
}

export function isNudgeEnabled(
  friendPresence: PresenceState,
  s: NudgeCooldown,
  now: number,
): boolean {
  return friendPresence !== "offline" && !isInCooldown(s, now);
}

export function nudgeSystemLine(displayName: string): string {
  return `You nudged ${displayName}`;
}

/** Milliseconds until the Nudge button is usable again (0 when not cooling down). */
export function cooldownRemainingMs(s: NudgeCooldown, now: number): number {
  if (s.lastNudgeAt === null) return 0;
  return Math.max(0, Math.min(NUDGE_COOLDOWN_MS, s.lastNudgeAt + NUDGE_COOLDOWN_MS - now));
}

/**
 * Restores a cooldown saved as a millisecond timestamp string, so closing and
 * reopening a chat window does not reset it (Req 6.3). Missing or corrupted
 * values mean no cooldown; a future timestamp (e.g. after a clock change) is
 * clamped to `now` so the button is never locked for more than the cooldown.
 */
export function readStoredCooldown(raw: string | null, now: number): NudgeCooldown {
  const t = raw === null || raw.trim() === "" ? NaN : Number(raw);
  if (!Number.isFinite(t)) return { lastNudgeAt: null };
  return { lastNudgeAt: Math.min(t, now) };
}
