import { NUDGE_COOLDOWN_MS } from "./cooldown";

/**
 * The receiving side of the Nudge limit. The sender's app already waits
 * between Buzzes (ADR 0007), but a modified app does not, so the Buddy List
 * also ignores a Buzz that comes sooner than it could have from an honest
 * app. A little less than the full cooldown absorbs clock and delivery jitter.
 */
export const INBOUND_MIN_GAP_MS = NUDGE_COOLDOWN_MS - 2000;

/** Last accepted Buzz per sender (ms). */
export type InboundLog = Map<string, number>;

/** True if a Buzz from `sender` at `now` should be shown; records it when it is. */
export function acceptInboundNudge(log: InboundLog, sender: string, now: number): boolean {
  const last = log.get(sender);
  if (last !== undefined && now - last < INBOUND_MIN_GAP_MS) return false;
  log.set(sender, now);
  return true;
}
