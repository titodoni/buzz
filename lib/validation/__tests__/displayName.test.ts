import { describe, it } from "vitest";
import fc from "fast-check";
import { isValidDisplayName } from "../profile";

// Feature: buzz, Property 5: Display name is required and non-whitespace
describe("Property 5: Display name is required and non-whitespace", () => {
  const ws = fc.array(fc.constantFrom(" ", "\t", "\n", "\r", "\u00a0", "\u2003"), { maxLength: 60 }).map((a) => a.join(""));
  it("rejects empty and whitespace-only", () => {
    fc.assert(fc.property(ws, (s) => !isValidDisplayName(s)), { numRuns: 200 });
  });
  it("accepts names with a visible character within 50 chars", () => {
    fc.assert(
      fc.property(ws, fc.stringMatching(/^[a-z]{1,10}$/), (pad, n) => isValidDisplayName(pad.slice(0, 10) + n)),
      { numRuns: 200 },
    );
  });
  it("is false for any string that trims to empty", () => {
    fc.assert(fc.property(fc.string(), (s) => s.trim() !== "" || !isValidDisplayName(s)), { numRuns: 200 });
  });
});
