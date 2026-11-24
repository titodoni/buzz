import { describe, it, expect } from "vitest"
import {
  RECENT_NUDGES_EMPTY,
  RECENT_NUDGES_MAX,
  addBadge,
  addRecent,
  agoText,
  clearBadge,
  readRecent,
} from "../recent"

const NOW = 50_000_000
const sec = (n: number) => n * 1000
const min = (n: number) => n * 60_000

// Feature: buzz-trigger, Nudge extended (R4.3): the last 10 Nudges, newest first
describe("addRecent", () => {
  it("puts the newest first", () => {
    const list = addRecent(addRecent([], { senderId: "ann", receivedAt: 1 }), { senderId: "bob", receivedAt: 2 })
    expect(list.map((n) => n.senderId)).toEqual(["bob", "ann"])
  })
  it("keeps only the last 10", () => {
    let list: ReturnType<typeof addRecent> = []
    for (let i = 1; i <= 12; i++) list = addRecent(list, { senderId: `f${i}`, receivedAt: i })
    expect(RECENT_NUDGES_MAX).toBe(10)
    expect(list).toHaveLength(10)
    expect(list[0].senderId).toBe("f12")
    expect(list[9].senderId).toBe("f3")
  })
  it("lists a friend twice when they Nudge twice", () => {
    const list = addRecent(addRecent([], { senderId: "ann", receivedAt: 1 }), { senderId: "ann", receivedAt: 2 })
    expect(list).toHaveLength(2)
  })
})

describe("readRecent", () => {
  it("reads a saved list, newest first", () => {
    const raw = JSON.stringify([
      { senderId: "ann", receivedAt: NOW - 5000 },
      { senderId: "bob", receivedAt: NOW - 1000 },
    ])
    expect(readRecent(raw, NOW).map((n) => n.senderId)).toEqual(["bob", "ann"])
  })
  it("treats missing or damaged values as empty", () => {
    for (const raw of [null, "", "soon", "{}", "[1,", '"x"']) expect(readRecent(raw, NOW)).toEqual([])
  })
  it("drops entries of the wrong shape", () => {
    const raw = JSON.stringify([
      { senderId: "ann", receivedAt: NOW - 1000 },
      { senderId: "", receivedAt: NOW },
      { senderId: 7, receivedAt: NOW },
      { senderId: "bob", receivedAt: "late" },
      null,
      "x",
    ])
    expect(readRecent(raw, NOW)).toEqual([{ senderId: "ann", receivedAt: NOW - 1000 }])
  })
  it("clamps a time in the future to now and keeps at most 10", () => {
    const raw = JSON.stringify(Array.from({ length: 14 }, (_, i) => ({ senderId: `f${i}`, receivedAt: NOW + min(60) })))
    const list = readRecent(raw, NOW)
    expect(list).toHaveLength(10)
    expect(list.every((n) => n.receivedAt === NOW)).toBe(true)
  })
})

describe("agoText", () => {
  it("says just now under a minute", () => {
    expect(agoText(NOW, NOW)).toBe("just now")
    expect(agoText(NOW - sec(59), NOW)).toBe("just now")
  })
  it("counts minutes, hours and days", () => {
    expect(agoText(NOW - min(1), NOW)).toBe("1 min ago")
    expect(agoText(NOW - min(59), NOW)).toBe("59 min ago")
    expect(agoText(NOW - min(60), NOW)).toBe("1 h ago")
    expect(agoText(NOW - min(60 * 23), NOW)).toBe("23 h ago")
    expect(agoText(NOW - min(60 * 24 * 2), NOW)).toBe("2 d ago")
  })
  it("treats a time in the future as just now", () => {
    expect(agoText(NOW + min(5), NOW)).toBe("just now")
  })
})

it("has the empty text from the spec", () => {
  expect(RECENT_NUDGES_EMPTY).toBe("No Nudges yet. Nudge a friend first.")
})

// R4.2: the red count on a row when the Chat Window could not take focus
describe("badges", () => {
  it("counts per friend and clears one friend at a time", () => {
    let b: Record<string, number> = {}
    b = addBadge(b, "ann")
    b = addBadge(b, "ann")
    b = addBadge(b, "bob")
    expect(b).toEqual({ ann: 2, bob: 1 })
    expect(clearBadge(b, "ann")).toEqual({ bob: 1 })
  })
  it("does not change the object it was given", () => {
    const b = { ann: 1 }
    addBadge(b, "ann")
    clearBadge(b, "ann")
    expect(b).toEqual({ ann: 1 })
  })
  it("clearing a friend with no badge changes nothing", () => {
    expect(clearBadge({ bob: 1 }, "ann")).toEqual({ bob: 1 })
  })
})
