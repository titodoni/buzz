import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { contrastRatio, relativeLuminance } from "../contrast";
import { skinTextPairs } from "../tokens";

const hex = fc
  .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
  .map(([r, g, b]) => "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join(""));

describe("skin contrast", () => {
  it("known values", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 10);
  });

  // Feature: buzz, Property 19: Skin contrast ratio
  it("Property 19: every skin text/background pair has contrast >= 4.5", () => {
    fc.assert(
      fc.property(fc.constantFrom(...skinTextPairs), (p) => {
        expect(contrastRatio(p.fg, p.bg)).toBeGreaterThanOrEqual(4.5);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: buzz, Property 19: Skin contrast ratio
  it("Property 19: contrastRatio is symmetric and within [1, 21]", () => {
    fc.assert(
      fc.property(hex, hex, (a, b) => {
        const r = contrastRatio(a, b);
        expect(r).toBe(contrastRatio(b, a));
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(21 + 1e-9);
      }),
      { numRuns: 200 },
    );
  });
});
