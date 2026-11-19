import { describe, it } from "vitest";
import fc from "fast-check";
import { checkAvatar } from "../profile";

// Feature: buzz, Property 6: Avatar upload validation
describe("Property 6: Avatar upload validation", () => {
  const okTypes = ["image/png", "image/jpeg", "image/webp"];
  const size = fc.oneof(
    fc.integer({ min: 0, max: 5_000_000 }),
    fc.constantFrom(0, 1, 2_097_151, 2_097_152, 2_097_153),
  );
  const type = fc.oneof(fc.constantFrom(...okTypes, "image/gif", "IMAGE/PNG", "image/svg+xml", "", "text/plain"), fc.string());
  it("ok iff size <= 2 MiB and type is png/jpeg/webp; reason otherwise", () => {
    fc.assert(
      fc.property(size, type, (s, t) => {
        const r = checkAvatar({ size: s, type: t });
        const expected = s <= 2_097_152 && okTypes.includes(t);
        if (r.ok !== expected) return false;
        return expected ? r.reason === undefined : typeof r.reason === "string" && r.reason.length > 0;
      }),
      { numRuns: 300 },
    );
  });
  it("reason names the violated constraint", () => {
    const big = checkAvatar({ size: 2_097_153, type: "image/png" });
    const fmt = checkAvatar({ size: 10, type: "image/gif" });
    if (!/2 MB/.test(big.reason ?? "")) throw new Error("size reason");
    if (!/PNG/.test(fmt.reason ?? "")) throw new Error("format reason");
  });
});
