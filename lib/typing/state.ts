export interface TypingState {
  lastKeystrokeAt: number | null;
  sent: boolean;
}

export const TYPING_IDLE_MS = 3000;

export function shouldShowTyping(s: TypingState, now: number): boolean {
  return (
    s.lastKeystrokeAt != null &&
    now - s.lastKeystrokeAt < TYPING_IDLE_MS &&
    !s.sent
  );
}

export function onKeystroke(_s: TypingState, now: number): TypingState {
  return { lastKeystrokeAt: now, sent: false };
}

export function onSend(s: TypingState): TypingState {
  return { ...s, sent: true };
}

export function typingLine(displayName: string): string {
  return `${displayName} is typing...`;
}
