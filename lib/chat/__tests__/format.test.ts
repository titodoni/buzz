import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { DEFAULT_FORMAT, formatToStyle, parseFormat, type MessageFormat } from "../format"

const hex = fc.constantFrom(..."0123456789abcdef".split(""))
const validFormat = fc.record({
  font: fc.constantFrom("Tahoma", "Verdana", "Arial", "Times New Roman"),
  size: fc.integer({ min: 10, max: 24 }),
  color: fc.array(hex, { minLength: 6, maxLength: 6 }).map((d) => `#${d.join("")}`),
  bold: fc.boolean(),
  italic: fc.boolean(),
  underline: fc.boolean(),
})

describe("parseFormat (Req 17.2, 17.4)", () => {
  it("keeps a valid format as it is", () => {
    const f = { font: "Verdana", size: 14, color: "#cc0000", bold: true, italic: false, underline: true }
    expect(parseFormat(f)).toEqual(f)
  })

  it("shows a message with no format in the default format", () => {
    expect(parseFormat(null)).toEqual(DEFAULT_FORMAT)
    expect(parseFormat(undefined)).toEqual(DEFAULT_FORMAT)
  })

  it("keeps every allowed combination", () => {
    fc.assert(fc.property(validFormat, (f) => {
        expect(parseFormat(f)).toEqual(f)
      }), { numRuns: 200 })
  })

  it("falls back to the default for a font Buzz doesn't offer", () => {
    fc.assert(
      fc.property(
        validFormat,
        fc.string().filter((s) => !["Tahoma", "Verdana", "Arial", "Times New Roman"].includes(s)),
        (f, font) => {
          expect(parseFormat({ ...f, font })).toEqual(DEFAULT_FORMAT)
        },
      ),
    )
    // Close but not equal: case and spacing count.
    for (const font of ["tahoma", "Times  New Roman", "Arial ", "Comic Sans MS"]) {
      expect(parseFormat({ ...DEFAULT_FORMAT, font })).toEqual(DEFAULT_FORMAT)
    }
  })

  it("falls back to the default for a size outside 10 to 24 or not a whole number", () => {
    for (const size of [9, 25, 0, -10, 12.5, Number.NaN, Number.POSITIVE_INFINITY, "12"]) {
      expect(parseFormat({ ...DEFAULT_FORMAT, size })).toEqual(DEFAULT_FORMAT)
    }
    expect(parseFormat({ ...DEFAULT_FORMAT, size: 10 }).size).toBe(10)
    expect(parseFormat({ ...DEFAULT_FORMAT, size: 24 }).size).toBe(24)
  })

  it("falls back to the default for any color that isn't lowercase #rrggbb", () => {
    for (const color of ["red", "#fff", "#CC0000", "#cc00001", "cc0000", "#cc00zz", "rgb(0,0,0)", "#000;x:y"]) {
      expect(parseFormat({ ...DEFAULT_FORMAT, color })).toEqual(DEFAULT_FORMAT)
    }
  })

  it("falls back to the default for missing, extra, or wrongly typed fields", () => {
    const missing: Record<string, unknown> = { ...DEFAULT_FORMAT }
    delete missing.bold
    expect(parseFormat(missing)).toEqual(DEFAULT_FORMAT)
    expect(parseFormat({ ...DEFAULT_FORMAT, bold: true, background: "#ff0000" })).toEqual(DEFAULT_FORMAT)
    expect(parseFormat({ ...DEFAULT_FORMAT, italic: "yes" })).toEqual(DEFAULT_FORMAT)
    for (const v of ["Tahoma", 12, true, [], [DEFAULT_FORMAT]]) expect(parseFormat(v)).toEqual(DEFAULT_FORMAT)
  })
})

describe("formatToStyle (Req 17.3, 17.4)", () => {
  it("turns a format into the matching inline style", () => {
    const f: MessageFormat = { font: "Times New Roman", size: 18, color: "#0033cc", bold: true, italic: true, underline: true }
    expect(formatToStyle(f)).toEqual({
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: "18pt",
      color: "#0033cc",
      fontWeight: 700,
      fontStyle: "italic",
      textDecoration: "underline",
    })
    expect(formatToStyle(DEFAULT_FORMAT)).toEqual({
      fontFamily: "Tahoma, Verdana, sans-serif",
      fontSize: "10pt",
      color: "#000000",
      fontWeight: 400,
      fontStyle: "normal",
      textDecoration: "none",
    })
  })

  it("never puts text from the input into a style value", () => {
    const FAMILIES = [
      "Tahoma, Verdana, sans-serif",
      "Verdana, Tahoma, sans-serif",
      "Arial, Helvetica, sans-serif",
      '"Times New Roman", Times, serif',
    ]
    // Anything at all, including formats that lie about their type.
    const hostile = fc.oneof(
      fc.anything(),
      fc.record({
        font: fc.string(),
        size: fc.oneof(fc.double(), fc.string()),
        color: fc.string(),
        bold: fc.anything(),
        italic: fc.anything(),
        underline: fc.anything(),
      }),
    )
    fc.assert(
      fc.property(hostile, (v) => {
        const s = formatToStyle(v as MessageFormat) // deliberately wrong type: this is the attack
        expect(FAMILIES).toContain(s.fontFamily)
        expect(s.fontSize).toMatch(/^(1\d|2[0-4])pt$/)
        expect(s.color).toMatch(/^#[0-9a-f]{6}$/)
        expect([400, 700]).toContain(s.fontWeight)
        expect(["normal", "italic"]).toContain(s.fontStyle)
        expect(["none", "underline"]).toContain(s.textDecoration)
      }),
      { numRuns: 300 },
    )
  })
})
