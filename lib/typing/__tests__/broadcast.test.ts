import { describe, it, expect } from "vitest";
import { receiveTypingSignal, shouldBroadcastTyping } from "../broadcast";
import { shouldShowTyping, type TypingState } from "../state";

const idle: TypingState = { lastKeystrokeAt: null, sent: false };

describe("receiveTypingSignal", () => {
  it("shows the indicator when a friend's typing signal arrives", () => {
    const s = receiveTypingSignal(idle, { stopped: false }, 1_000);
    expect(shouldShowTyping(s, 1_500)).toBe(true);
  });

  it("clears it when the friend sends, so a late signal can't relight it (Req 10.3)", () => {
    let s = receiveTypingSignal(idle, { stopped: false }, 1_000);
    s = receiveTypingSignal(s, { stopped: true }, 1_200);
    expect(shouldShowTyping(s, 1_300)).toBe(false);
  });
});

describe("shouldBroadcastTyping", () => {
  it("broadcasts on the first keystroke", () => {
    expect(shouldBroadcastTyping(null, 5_000)).toBe(true);
  });

  it("stays quiet for keystrokes within 1 second of the last broadcast", () => {
    expect(shouldBroadcastTyping(5_000, 5_999)).toBe(false);
  });

  it("broadcasts again once 1 second has passed, well inside the 3 s indicator window", () => {
    expect(shouldBroadcastTyping(5_000, 6_000)).toBe(true);
  });
});
