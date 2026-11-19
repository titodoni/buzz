import { describe, it } from "vitest";
import fc from "fast-check";
import { hasNowPlaying, shouldShowField } from "../render";

// Feature: buzz, Property 20: Status and Now_Playing display
describe("Property 20: Status and Now_Playing display", () => {
  const ws = fc.array(fc.constantFrom(" ", "\t", "\n", "\u00a0"), { maxLength: 30 }).map((a) => a.join(""));
  const blank = fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant(""), ws);
  const any = fc.oneof(blank, fc.string({ maxLength: 140 }));
  it("hides empty, whitespace-only, null and undefined values", () => {
    fc.assert(
      fc.property(blank, (v) => !shouldShowField(v) && !hasNowPlaying(v)),
      { numRuns: 200 },
    );
  });
  it("shows a field iff it is non-empty after trim; glyph iff now_playing non-empty", () => {
    fc.assert(
      fc.property(any, (v) => {
        const expected = typeof v === "string" && v.trim().length > 0;
        return shouldShowField(v) === expected && hasNowPlaying(v) === expected;
      }),
      { numRuns: 300 },
    );
  });
});
