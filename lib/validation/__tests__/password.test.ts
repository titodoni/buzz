import { describe, it } from "vitest";
import fc from "fast-check";
import { isValidPassword } from "../profile";

// Feature: buzz, Property 2: Password length validation
describe("Property 2: Password length validation", () => {
  it("is true iff 8 <= length <= 128", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (s) => isValidPassword(s) === (s.length >= 8 && s.length <= 128)),
      { numRuns: 300 },
    );
  });
  it("is correct at exact limits", () => {
    fc.assert(
      fc.property(fc.constantFrom(0, 7, 8, 9, 127, 128, 129), fc.constantFrom("x", " ", "é"), (n, c) => {
        return isValidPassword(c.repeat(n)) === (n >= 8 && n <= 128);
      }),
      { numRuns: 100 },
    );
  });
});
