import { onKeystroke, onSend, type TypingState } from "./state";

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

/** Payload of a `typing` broadcast. `stopped` is sent right after a message. */
export interface TypingSignal {
  stopped: boolean;
}

/**
 * Applies a friend's typing broadcast to the receiver's typing state.
 * Broadcasts arrive in order, so the `stopped` signal sent after a message
 * always follows any earlier typing signals and keeps the indicator off.
 */
export function receiveTypingSignal(
  state: TypingState,
  signal: TypingSignal,
  now: number,
): TypingState {
  return signal.stopped ? onSend(state) : onKeystroke(state, now);
}
