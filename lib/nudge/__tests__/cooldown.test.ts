import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  NUDGE_COOLDOWN_MS,
  NUDGE_SHAKE_MS,
  isInCooldown,
  isNudgeEnabled,
  nudgeSystemLine,
  onNudgeResult,
  type NudgeCooldown,
} from "../cooldown";
import type { PresenceState } from "../../presence/state";

const t = fc.integer({ min: 0, max: 2_000_000_000 });
const delta = fc.oneof(
  fc.constantFrom(
    0,
    NUDGE_COOLDOWN_MS - 1,
    NUDGE_COOLDOWN_MS,
    NUDGE_COOLDOWN_MS + 1,
  ),
  fc.integer({ min: -100_000, max: 100_000 }),
);
const cooldownArb: fc.Arbitrary<NudgeCooldown> = fc.oneof(
  fc.constant({ lastNudgeAt: null }),
  t.map((lastNudgeAt) => ({ lastNudgeAt })),
);
const presenceArb = fc.constantFrom<PresenceState>(
  "online",
  "away",
  "busy",
  "offline",
);
const opts = { numRuns: 200 };

// Feature: buzz, Property 14: Nudge availability and cooldown
describe("Property 14: Nudge availability and cooldown", () => {
  it("constants", () => {
    expect(NUDGE_COOLDOWN_MS).toBe(10_000);
    expect(NUDGE_SHAKE_MS).toBe(600);
  });

  it("isInCooldown iff lastNudgeAt != null and now - lastNudgeAt < 10_000", () => {
    fc.assert(
      fc.property(t, delta, (last, d) => {
        expect(isInCooldown({ lastNudgeAt: last }, last + d)).toBe(d < 10_000);
      }),
      opts,
    );
    expect(isInCooldown({ lastNudgeAt: null }, 5)).toBe(false);
    expect(isInCooldown({ lastNudgeAt: 0 }, 9_999)).toBe(true);
    expect(isInCooldown({ lastNudgeAt: 0 }, 10_000)).toBe(false);
    expect(isInCooldown({ lastNudgeAt: 0 }, 10_001)).toBe(false);
  });

  it("enabled iff presence != offline and not in cooldown", () => {
    fc.assert(
      fc.property(presenceArb, cooldownArb, t, (p, s, now) => {
        expect(isNudgeEnabled(p, s, now)).toBe(
          p !== "offline" && !isInCooldown(s, now),
        );
      }),
      opts,
    );
  });

  it("onNudgeResult sets lastNudgeAt = now only when delivered", () => {
    fc.assert(
      fc.property(cooldownArb, t, (s, now) => {
        expect(onNudgeResult(s, now, true)).toEqual({ lastNudgeAt: now });
        expect(onNudgeResult(s, now, false)).toEqual(s);
      }),
      opts,
    );
  });

  it("failed delivery keeps the button enabled for an online friend", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PresenceState>("online", "away", "busy"),
        t,
        (p, now) => {
          const s = onNudgeResult({ lastNudgeAt: null }, now, false);
          expect(isNudgeEnabled(p, s, now)).toBe(true);
        },
      ),
      opts,
    );
  });

  it("delivered nudge disables the button for 10 s", () => {
    fc.assert(
      fc.property(t, delta, (now, d) => {
        const s = onNudgeResult({ lastNudgeAt: null }, now, true);
        expect(isNudgeEnabled("online", s, now + d)).toBe(d >= 10_000);
      }),
      opts,
    );
  });

  it("system line is exactly 'You nudged ' + name", () => {
    fc.assert(
      fc.property(fc.string(), (name) => {
        expect(nudgeSystemLine(name)).toBe("You nudged " + name);
      }),
      opts,
    );
  });
});
