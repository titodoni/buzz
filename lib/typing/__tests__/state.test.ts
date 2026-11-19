import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  TYPING_IDLE_MS,
  onKeystroke,
  onSend,
  shouldShowTyping,
  typingLine,
  type TypingState,
} from "../state";

const t = fc.integer({ min: 0, max: 2_000_000_000 });
const delta = fc.oneof(
  fc.constantFrom(0, TYPING_IDLE_MS - 1, TYPING_IDLE_MS, TYPING_IDLE_MS + 1),
  fc.integer({ min: -10_000, max: 10_000 }),
);
const stateArb: fc.Arbitrary<TypingState> = fc.record({
  lastKeystrokeAt: fc.option(t, { nil: null }),
  sent: fc.boolean(),
});
const opts = { numRuns: 200 };

// Feature: buzz, Property 15: Typing indicator state machine
describe("Property 15: Typing indicator state machine", () => {
  it("shouldShowTyping iff lastKeystrokeAt != null, now - last < 3000, !sent", () => {
    fc.assert(
      fc.property(stateArb, t, (s, now) => {
        expect(shouldShowTyping(s, now)).toBe(
          s.lastKeystrokeAt != null &&
            now - s.lastKeystrokeAt < 3000 &&
            !s.sent,
        );
      }),
      opts,
    );
  });

  it("boundary at 3 s, +/-1 ms", () => {
    const s = { lastKeystrokeAt: 1000, sent: false };
    expect(shouldShowTyping(s, 1000 + 2999)).toBe(true);
    expect(shouldShowTyping(s, 1000 + 3000)).toBe(false);
    expect(shouldShowTyping(s, 1000 + 3001)).toBe(false);
    expect(shouldShowTyping({ lastKeystrokeAt: null, sent: false }, 0)).toBe(
      false,
    );
  });

  it("boundary generator: keystroke then delta", () => {
    fc.assert(
      fc.property(t, delta, (k, d) => {
        const s = onKeystroke({ lastKeystrokeAt: null, sent: true }, k);
        expect(shouldShowTyping(s, k + d)).toBe(d < 3000);
      }),
      opts,
    );
  });

  it("onKeystroke sets lastKeystrokeAt = now and sent = false", () => {
    fc.assert(
      fc.property(stateArb, t, (s, now) => {
        expect(onKeystroke(s, now)).toEqual({
          lastKeystrokeAt: now,
          sent: false,
        });
      }),
      opts,
    );
  });

  it("onSend sets sent = true and clears the indicator until next keystroke", () => {
    fc.assert(
      fc.property(stateArb, t, delta, t, (s, now, d, k) => {
        const sent = onSend(s);
        expect(sent.sent).toBe(true);
        expect(sent.lastKeystrokeAt).toBe(s.lastKeystrokeAt);
        expect(shouldShowTyping(sent, now + d)).toBe(false);
        expect(shouldShowTyping(onKeystroke(sent, k), k)).toBe(true);
      }),
      opts,
    );
  });

  it("typingLine format", () => {
    fc.assert(
      fc.property(fc.string(), (n) => {
        expect(typingLine(n)).toBe(`${n} is typing...`);
      }),
      opts,
    );
  });
});
