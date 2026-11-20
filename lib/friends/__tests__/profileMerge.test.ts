import { describe, it, expect } from "vitest"
import { PROFILE_FILTER_MAX, mergeOne, mergeProfile, profileFilters } from "../profileMerge"

const p = (id: string, over: Partial<{ statusMessage: string | null; nowPlaying: string | null }> = {}) => ({
  id,
  displayName: id.toUpperCase(),
  avatarUrl: null,
  statusMessage: null,
  nowPlaying: null,
  ...over,
})

describe("profileFilters (R0)", () => {
  it("is empty with no ids", () => {
    expect(profileFilters([])).toEqual([])
  })

  it("sorts and de-duplicates so the same set gives the same filter", () => {
    expect(profileFilters(["b", "a", "b"])).toEqual(["id=in.(a,b)"])
  })

  it("splits more than 100 ids into several filters", () => {
    const ids = Array.from({ length: PROFILE_FILTER_MAX + 1 }, (_, i) => `u${String(i).padStart(3, "0")}`)
    const out = profileFilters(ids)
    expect(out).toHaveLength(2)
    expect(out[1]).toBe(`id=in.(u${PROFILE_FILTER_MAX})`)
  })
})

describe("mergeProfile (R0)", () => {
  it("updates the matching friend and keeps extra fields", () => {
    const list = [{ ...p("a"), friendshipId: "f1" }, { ...p("b"), friendshipId: "f2" }]
    const next = mergeProfile(list, p("a", { nowPlaying: "Song" }))
    expect(next[0]).toEqual({ ...p("a", { nowPlaying: "Song" }), friendshipId: "f1" })
    expect(next[1]).toBe(list[1])
  })

  it("returns the same array for an unknown id or no change", () => {
    const list = [p("a")]
    expect(mergeProfile(list, p("z", { statusMessage: "hi" }))).toBe(list)
    expect(mergeProfile(list, p("a"))).toBe(list)
  })
})

describe("mergeOne (R0)", () => {
  it("updates only the same person", () => {
    expect(mergeOne(p("a"), p("a", { statusMessage: "Out to Lunch" }))?.statusMessage).toBe("Out to Lunch")
    const cur = p("a")
    expect(mergeOne(cur, p("b", { statusMessage: "x" }))).toBe(cur)
    expect(mergeOne(null, p("a"))).toBeNull()
  })
})
