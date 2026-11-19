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
