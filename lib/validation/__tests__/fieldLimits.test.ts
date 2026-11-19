import { describe, it } from "vitest";
import fc from "fast-check";
import { isValidDisplayName, isValidNowPlaying, isValidStatus } from "../profile";

// Feature: buzz, Property 4: Profile field length limits
describe("Property 4: Profile field length limits", () => {
  const lens = fc.constantFrom(0, 1, 49, 50, 51, 139, 140, 141, 200);
  const sized = fc.tuple(lens, fc.constantFrom("a", "é", "😀")).map(([n, c]) => c.repeat(n));
  const gen = fc.oneof(fc.string({ maxLength: 200 }), sized);
  it("status and now_playing accept iff length <= 140", () => {
    fc.assert(
      fc.property(gen, (s) => isValidStatus(s) === s.length <= 140 && isValidNowPlaying(s) === s.length <= 140),
      { numRuns: 300 },
    );
  });
  it("display_name length bound is 50 (for non-blank names)", () => {
    fc.assert(
      fc.property(gen, (s) => {
        fc.pre(s.trim().length > 0);
        return isValidDisplayName(s) === s.length <= 50;
      }),
      { numRuns: 300 },
    );
  });
});
