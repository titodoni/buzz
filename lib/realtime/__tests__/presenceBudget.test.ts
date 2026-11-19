import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { PRESENCE_BUDGET, PRESENCE_WINDOW_MS, planPresenceSend } from "../presenceBudget";

// Supabase closes a channel after 5 track/untrack calls in 30 s from one client.
describe("planPresenceSend", () => {
  it("stays below Supabase's limit of 5 updates per 30 s", () => {
    expect(PRESENCE_WINDOW_MS).toBe(30_000);
    expect(PRESENCE_BUDGET).toBeLessThan(5);
  });

  it("sends at once when nothing was sent recently", () => {
    expect(planPresenceSend([], 1_000)).toEqual({ sendNow: true, waitMs: 0, recent: [] });
  });

  it("waits until the oldest recent send leaves the window", () => {
    const sent = [10_000, 11_000, 12_000, 13_000];
    expect(planPresenceSend(sent, 20_000)).toEqual({ sendNow: false, waitMs: 20_000, recent: sent });
  });

  it("forgets sends that are 30 s old or more", () => {
    expect(planPresenceSend([0, 1_000, 2_000, 3_000], 30_000)).toEqual({
      sendNow: true,
      waitMs: 0,
      recent: [1_000, 2_000, 3_000],
    });
  });

  it("never allows more than the budget inside any 30 s window", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 120_000 }), { maxLength: 40 }), (asks) => {
        const sentAt: number[] = [];
        for (const now of [...asks].sort((a, b) => a - b)) {
          const plan = planPresenceSend(sentAt, now);
          if (plan.sendNow) sentAt.push(now);
          else expect(plan.waitMs).toBeGreaterThan(0);
        }
        for (const t of sentAt) {
          expect(sentAt.filter((u) => u >= t && u < t + PRESENCE_WINDOW_MS).length).toBeLessThanOrEqual(PRESENCE_BUDGET);
        }
      }),
    );
  });
});
