import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { DEFAULT_BUDDY_VIEW, parseBuddyView, toggleCollapsed } from "../buddyView"

describe("parseBuddyView (Req 14.7, 14.8)", () => {
  it("defaults to showing offline friends and nothing collapsed", () => {
    expect(DEFAULT_BUDDY_VIEW).toEqual({ showOffline: true, collapsed: [] })
    expect(parseBuddyView(null)).toEqual(DEFAULT_BUDDY_VIEW)
  })

  it("reads a saved view and ignores damaged parts", () => {
    expect(parseBuddyView('{"showOffline":false,"collapsed":["g1","default"]}')).toEqual({
      showOffline: false,
      collapsed: ["g1", "default"],
    })
    expect(parseBuddyView('{"showOffline":"x","collapsed":["g1",5,null]}')).toEqual({
      showOffline: true,
      collapsed: ["g1"],
    })
  })

  it("never throws", () => {
    fc.assert(fc.property(fc.oneof(fc.string(), fc.json()), (raw) => void parseBuddyView(raw)))
  })
})

describe("toggleCollapsed", () => {
  it("adds a group once and removes it on the second toggle", () => {
    const once = toggleCollapsed(DEFAULT_BUDDY_VIEW, "g1")
    expect(once.collapsed).toEqual(["g1"])
    expect(toggleCollapsed(once, "g1").collapsed).toEqual([])
  })
})
