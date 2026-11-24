import { describe, it, expect } from "vitest"
import { HANGOUT_TEMPLATES, HANGOUT_TEXT_MAX, validateHangoutText } from "../templates"

// Feature: buzz-trigger, Hangout (R3.1)
describe("HANGOUT_TEMPLATES", () => {
  it("offers exactly the four templates from the spec", () => {
    expect(HANGOUT_TEMPLATES).toEqual([
      "Play a game?",
      "Just talk for a bit?",
      "Study together?",
      "Hop in a call elsewhere?",
    ])
  })
})

describe("validateHangoutText", () => {
  it("accepts a template", () => {
    expect(validateHangoutText("Play a game?")).toEqual({ ok: true, text: "Play a game?" })
  })
  it("trims the custom text", () => {
    expect(validateHangoutText("  movie night?  ")).toEqual({ ok: true, text: "movie night?" })
  })
  it("rejects empty and whitespace-only text", () => {
    expect(validateHangoutText("")).toEqual({ ok: false, reason: "empty" })
    expect(validateHangoutText("   \n ")).toEqual({ ok: false, reason: "empty" })
  })
  it("accepts exactly 60 characters and rejects 61", () => {
    expect(HANGOUT_TEXT_MAX).toBe(60)
    expect(validateHangoutText("x".repeat(60)).ok).toBe(true)
    expect(validateHangoutText("x".repeat(61))).toEqual({ ok: false, reason: "too-long" })
  })
  it("counts the trimmed text, not the padding", () => {
    expect(validateHangoutText(` ${"x".repeat(60)} `).ok).toBe(true)
  })
})
