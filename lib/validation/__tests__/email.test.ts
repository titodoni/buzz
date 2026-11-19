import { describe, it } from "vitest";
import fc from "fast-check";
import { isValidEmail } from "../profile";

// Feature: buzz, Property 1: Email format validation
describe("Property 1: Email format validation", () => {
  const ref = (s: string) => {
    if (/\s/.test(s)) return false;
    const i = s.indexOf("@");
    return i > 0 && i < s.length - 1 && s.indexOf("@", i + 1) === -1;
  };
  const piece = fc.stringMatching(/^[a-z0-9.+_-]{1,20}$/);
  it("accepts local@domain", () => {
    fc.assert(
      fc.property(piece, piece, (l, d) => isValidEmail(`${l}@${d}`)),
      { numRuns: 200 },
    );
  });
  it("matches the reference predicate for arbitrary strings", () => {
    const chars = fc.constantFrom("a", "b", "@", "@", " ", "\t", "\n", ".");
    const gen = fc.oneof(fc.string(), fc.array(chars, { maxLength: 8 }).map((a) => a.join("")));
    fc.assert(fc.property(gen, (s) => isValidEmail(s) === ref(s)), { numRuns: 500 });
  });
  it("rejects edge cases", () => {
    for (const s of ["", "@", "a@", "@b", "a@@b", "a@b@c", "a @b", "a@ b", "a@b\n"]) {
      if (isValidEmail(s)) throw new Error(`should reject ${JSON.stringify(s)}`);
    }
  });
});
