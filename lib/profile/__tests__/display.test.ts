import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { NOW_PLAYING_SHOWN_MAX, hasNowPlaying, shouldShowField, shownNowPlaying } from "../render";

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

describe("shownNowPlaying (buzz-trigger R5.1)", () => {
  it("keeps a line of 40 characters or fewer", () => {
    expect(shownNowPlaying("Copeland - Love Affair")).toBe("Copeland - Love Affair")
    expect(shownNowPlaying("x".repeat(NOW_PLAYING_SHOWN_MAX))).toBe("x".repeat(NOW_PLAYING_SHOWN_MAX))
  })

  it("cuts a longer line to 40 characters ending in ...", () => {
    const out = shownNowPlaying("A very long artist name - An even longer song title here")
    expect([...out]).toHaveLength(NOW_PLAYING_SHOWN_MAX)
    expect(out.endsWith("...")).toBe(true)
  })

  it("never splits a character", () => {
    expect([...shownNowPlaying("é".repeat(100))]).toHaveLength(NOW_PLAYING_SHOWN_MAX)
  })
})
