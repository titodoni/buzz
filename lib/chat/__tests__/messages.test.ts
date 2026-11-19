import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { loadRecentMessages, isOfflineMessage } from "../messages";

const BASE = Date.UTC(2025, 0, 1);
// small time range forces ties
const msg = fc.record({
  id: fc.uuid(),
  created_at: fc.integer({ min: 0, max: 30 }).map((s) => new Date(BASE + s * 1000).toISOString()),
});

describe("loadRecentMessages", () => {
  // Feature: buzz, Property 10: Most-recent message loading
  it("returns the 50 greatest created_at, oldest-first; all when <= 50", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.array(msg, { maxLength: 130 }),
          fc.constantFrom(49, 50, 51).chain((n) => fc.array(msg, { minLength: n, maxLength: n })),
        ),
        (all) => {
          const copy = [...all];
          const res = loadRecentMessages(all, 50);
          expect(all).toEqual(copy);
          expect(res.length).toBe(Math.min(all.length, 50));
          const ts = res.map((m) => Date.parse(m.created_at));
          expect(ts).toEqual([...ts].sort((a, b) => a - b));
          const expected = all.map((m) => Date.parse(m.created_at)).sort((a, b) => b - a).slice(0, 50).sort((a, b) => a - b);
          expect(ts).toEqual(expected);
          if (all.length <= 50) expect(res).toHaveLength(all.length);
          for (const m of res) expect(all).toContain(m);
          expect(new Set(res).size).toBe(res.length);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("compares parsed instants, not strings", () => {
    const a = { created_at: "2025-01-01T01:00:00+01:00" }; // 00:00Z
    const b = { created_at: "2025-01-01T00:30:00Z" };
    expect(loadRecentMessages([b, a], 1)).toEqual([b]);
  });
});

describe("isOfflineMessage", () => {
  // Feature: buzz, Property 12: Offline-message classification and retention cutoff
  it("is true iff delivered_at is null", () => {
    fc.assert(
      fc.property(fc.option(fc.string(), { nil: null }), (d) => {
        expect(isOfflineMessage({ delivered_at: d })).toBe(d === null);
      }),
      { numRuns: 100 },
    );
  });
});
