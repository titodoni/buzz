import { describe, it, expect } from "vitest";
import { cooldownRemainingMs, isInCooldown, readStoredCooldown } from "../cooldown";

describe("stored nudge cooldown (Req 6.3 survives reopening the chat)", () => {
  it("restores a cooldown saved 4 s ago, with 6 s left", () => {
    const s = readStoredCooldown("96000", 100_000);
    expect(isInCooldown(s, 100_000)).toBe(true);
    expect(cooldownRemainingMs(s, 100_000)).toBe(6_000);
  });

  it("treats a missing or corrupted value as no cooldown", () => {
    for (const raw of [null, "", "soon", "NaN", "Infinity"]) {
      expect(readStoredCooldown(raw, 100_000)).toEqual({ lastNudgeAt: null });
    }
  });

  it("never locks the button longer than 10 s if the stored time is in the future", () => {
    const s = readStoredCooldown("999999999", 100_000);
    expect(cooldownRemainingMs(s, 100_000)).toBe(10_000);
    expect(isInCooldown(s, 110_000)).toBe(false);
  });

  it("reports 0 ms remaining when there is no cooldown", () => {
    expect(cooldownRemainingMs({ lastNudgeAt: null }, 5)).toBe(0);
  });
});
