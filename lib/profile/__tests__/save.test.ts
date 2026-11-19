import { describe, expect, it } from "vitest"
import fc from "fast-check"
import { planProfileSave, type ProfileFields } from "../save"

const prev: ProfileFields = { display_name: "Old", status_message: "hi", now_playing: "song" }
const runs = { numRuns: 100 }
const ws = fc.stringMatching(/^[ \t\n]*$/)

describe("planProfileSave", () => {
  it("rejects over-limit drafts with no patch", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 141, maxLength: 200 }), (long) => {
        for (const draft of [
          { display_name: "ok", status_message: long, now_playing: "" },
          { display_name: "ok", status_message: "", now_playing: long },
          { display_name: long, status_message: "", now_playing: "" },
        ]) {
          const plan = planProfileSave(prev, draft)
          expect(plan.ok).toBe(false)
          expect("patch" in plan).toBe(false)
        }
      }),
      runs,
    )
  })
  it("whitespace display name keeps the previous name", () => {
    fc.assert(
      fc.property(ws, (name) => {
        const plan = planProfileSave(prev, { display_name: name, status_message: "", now_playing: "" })
        expect(plan).toMatchObject({
          ok: false,
          field: "display_name",
          message: "Your display name can't be empty.",
        })
        if (!plan.ok) expect(plan.keep.display_name).toBe("Old")
      }),
      runs,
    )
  })
  it("blank status/now playing become null", () => {
    fc.assert(
      fc.property(ws, ws, (s, n) => {
        const plan = planProfileSave(prev, { display_name: "New", status_message: s, now_playing: n })
        expect(plan).toEqual({
          ok: true,
          patch: { display_name: "New", status_message: null, now_playing: null },
        })
      }),
      runs,
    )
  })
  it("valid drafts produce a patch within limits", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.string({ maxLength: 140 }),
        fc.string({ maxLength: 140 }),
        (d, s, n) => {
          const plan = planProfileSave(prev, { display_name: d, status_message: s, now_playing: n })
          expect(plan.ok).toBe(true)
        },
      ),
      runs,
    )
  })
})
