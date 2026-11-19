import { describe, it } from "vitest";
import fc from "fast-check";
import { displayNameFromEmail, isValidEmail } from "../profile";

// Feature: buzz, Property 3: Display name derivation from email
describe("Property 3: Display name derivation from email", () => {
  const local = fc.oneof(
    fc.stringMatching(/^[a-zA-Z0-9.+_-]{1,80}$/),
    fc.constantFrom(49, 50, 51).map((n) => "a".repeat(n)),
  );
  const domain = fc.stringMatching(/^[a-z0-9.-]{1,20}$/);
  it("is the prefix before the first @, cut to 50, and non-empty", () => {
    fc.assert(
      fc.property(local, domain, (l, d) => {
        const e = `${l}@${d}`;
        fc.pre(isValidEmail(e));
        const name = displayNameFromEmail(e);
        return name === l.slice(0, 50) && name.length > 0 && name.length <= 50;
      }),
      { numRuns: 200 },
    );
  });
  it("never returns empty, even for malformed input (falls back to 'buddy')", () => {
    fc.assert(
      fc.property(fc.string(), (s) => displayNameFromEmail(s).length > 0),
      { numRuns: 200 },
    );
    if (displayNameFromEmail("@x.com") !== "buddy") throw new Error("fallback");
    if (displayNameFromEmail("") !== "buddy") throw new Error("fallback");
  });
});
