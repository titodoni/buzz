import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  EMOTICONS,
  PICKER_EMOTICONS,
  SHORTCODE_MAP,
  insertAtCursor,
  renderMessage,
} from "../shortcode";

const codes = Object.keys(SHORTCODE_MAP);
const shortcodeArb = fc.constantFrom(...codes);
// Same shortcode with random letter casing.
const mixedCaseArb = shortcodeArb.chain((c) =>
  fc
    .array(fc.boolean(), { minLength: c.length, maxLength: c.length })
    .map((flags) => [...c].map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase())).join("")),
);
const junkArb = fc.constantFrom(":foo:", ":bar", ":xyz:", ";;;", ":-Z", "::", "):", "(:", ":", ";", "-", "8", "hello", " ", "\n");
const bodyArb = fc
  .array(fc.oneof(shortcodeArb, mixedCaseArb, junkArb, fc.string(), fc.string({ unit: "binary" })), { maxLength: 12 })
  .map((parts) => parts.join(""));

const reconstruct = (b: string) =>
  renderMessage(b)
    .map((t) => (t.type === "text" ? t.value : t.source))
    .join("");

describe("emoticon pack", () => {
  // Feature: buzz, Property 16: Emoticon pack validity
  it("Property 16: >=30 entries, unique shortcodes, unique image paths", () => {
    fc.assert(
      fc.property(fc.constant(SHORTCODE_MAP), (map) => {
        const keys = Object.keys(map);
        const paths = Object.values(map);
        expect(keys.length).toBeGreaterThanOrEqual(30);
        expect(new Set(keys).size).toBe(keys.length);
        expect(new Set(keys.map((k) => k.toLowerCase())).size).toBe(keys.length);
        expect(new Set(paths).size).toBe(paths.length);
      }),
      { numRuns: 100 },
    );
  });

  it("has >=35 visible entries, hidden extras, and an SVG file per path", () => {
    expect(PICKER_EMOTICONS.length).toBeGreaterThanOrEqual(35);
    expect(EMOTICONS.length).toBeGreaterThan(PICKER_EMOTICONS.length);
    for (const e of EMOTICONS) {
      expect(existsSync(join(process.cwd(), "public", e.path))).toBe(true);
    }
  });
});

describe("insertAtCursor", () => {
  // Feature: buzz, Property 17: Emoticon insertion at cursor
  it("Property 17: inserts at the cursor and preserves surrounding text", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.nat(),
        fc.oneof(shortcodeArb, fc.string()),
        (t, n, c) => {
          const pos = t.length === 0 ? 0 : n % (t.length + 1);
          const r = insertAtCursor(t, pos, c);
          expect(r.text).toBe(t.slice(0, pos) + c + t.slice(pos));
          expect(r.pos).toBe(pos + c.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("clamps out-of-range positions", () => {
    expect(insertAtCursor("abc", -5, ":)")).toEqual({ text: ":)abc", pos: 2 });
    expect(insertAtCursor("abc", 99, ":)")).toEqual({ text: "abc:)", pos: 5 });
  });
});

describe("renderMessage", () => {
  // Feature: buzz, Property 18: Emoticon shortcode rendering and fallback
  it("Property 18: reconstructs the body, merges text, maps recognized codes", () => {
    fc.assert(
      fc.property(bodyArb, (b) => {
        const tokens = renderMessage(b);
        expect(reconstruct(b)).toBe(b);
        tokens.forEach((t, i) => {
          if (t.type === "emoticon") {
            expect(t.value).toBe(SHORTCODE_MAP[codes.find((c) => c.toLowerCase() === t.source.toLowerCase())!]);
          } else {
            expect(t.value.length).toBeGreaterThan(0);
            expect(tokens[i + 1]?.type).not.toBe("text");
          }
        });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: buzz, Property 18 (recognition): standalone shortcodes become emoticon tokens
  it("Property 18: space-separated shortcodes (any case) all become emoticon tokens", () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(shortcodeArb, mixedCaseArb), { minLength: 1, maxLength: 8 }), (list) => {
        const tokens = renderMessage(list.join(" "));
        const emo = tokens.filter((t) => t.type === "emoticon");
        expect(emo.map((t) => t.type === "emoticon" && t.source)).toEqual(list);
      }),
      { numRuns: 100 },
    );
  });

  it("keeps shortcode-shaped junk as text", () => {
    expect(renderMessage(":foo: hi")).toEqual([{ type: "text", value: ":foo: hi" }]);
    expect(renderMessage("")).toEqual([]);
  });

  it("longest match wins and case is ignored", () => {
    const one = (s: string) => renderMessage(s).map((t) => (t.type === "emoticon" ? t.source : t.value));
    expect(one(":))")).toEqual([":))"]);
    expect(one(":)>-")).toEqual([":)>-"]);
    expect(one(":)")).toEqual([":)"]);
    expect(one(":d/")).toEqual([":d/"]);
    expect(one(">:d<")).toEqual([">:d<"]);
    expect(renderMessage(":p")[0]).toMatchObject({ type: "emoticon", value: SHORTCODE_MAP[":P"] });
  });
});
