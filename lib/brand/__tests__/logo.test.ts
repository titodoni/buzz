import { describe, expect, it } from "vitest";
import { heroInner, logoInner, logoSvg, logoThemeNames, logoThemes } from "../logo";

describe("logo", () => {
  it("has the four themes, each with valid hex colors", () => {
    expect(logoThemeNames).toEqual(["classic", "sakura", "ember", "midnight"]);
    for (const t of Object.values(logoThemes)) {
      for (const c of [t.tileTop, t.tileBottom, t.rays, t.spark, t.letter, t.outline]) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("draws the burst and sparkles only when sparks are on", () => {
    expect(logoInner("classic", true, "x")).toContain("clip-path");
    expect(logoInner("classic", false, "x")).not.toContain("clip-path");
  });

  it("prefixes every id so two logos on one page do not clash", () => {
    const html = logoInner("sakura", true, "p1");
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id.startsWith("p1-")).toBe(true);
  });

  it("makes a standalone svg for every theme", () => {
    for (const name of logoThemeNames) {
      expect(logoSvg(name, true)).toMatch(/^<svg [^>]*viewBox="0 0 100 100">/);
    }
  });

  it("builds a hero banner per theme with prefixed ids", () => {
    for (const name of logoThemeNames) {
      const ids = [...heroInner(name, "h1").matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(id.startsWith("h1-")).toBe(true);
    }
  });
});
