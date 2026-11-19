import { describe, it } from "vitest";
import fc from "fast-check";
import { isValidMessageBody } from "../profile";

// Feature: buzz, Property 11: Message body validation
describe("Property 11: Message body validation", () => {
  const ws = fc.array(fc.constantFrom(" ", "\t", "\n", "\r"), { maxLength: 1100 }).map((a) => a.join(""));
  const sized = fc.constantFrom(0, 1, 999, 1000, 1001, 1500).map((n) => "a".repeat(n));
  const gen = fc.oneof(fc.string({ maxLength: 1200 }), ws, sized);
  it("true iff non-empty, not whitespace-only, and length <= 1000", () => {
    fc.assert(
      fc.property(gen, (s) => isValidMessageBody(s) === (s.trim().length > 0 && s.length <= 1000)),
      { numRuns: 300 },
    );
  });
  it("rejects whitespace-only at any length", () => {
    fc.assert(fc.property(ws, (s) => !isValidMessageBody(s)), { numRuns: 200 });
  });
});
