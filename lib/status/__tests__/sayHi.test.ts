import { describe, it, expect } from "vitest"
import { SAY_HI_GUARD_MS, canSayHi, isFriendUpForChat } from "../sayHi"
import { UP_FOR_CHAT_TEXT } from "../upForChat"

// Feature: buzz-trigger, Say hi (R2.3)
describe("isFriendUpForChat", () => {
  it("needs the Up for Chat line and Available", () => {
    expect(isFriendUpForChat(UP_FOR_CHAT_TEXT, "online")).toBe(true)
  })
  it("is false for any other presence", () => {
    for (const p of ["away", "busy", "offline"] as const) expect(isFriendUpForChat(UP_FOR_CHAT_TEXT, p)).toBe(false)
  })
  it("is false for other or empty Status", () => {
    expect(isFriendUpForChat("hello", "online")).toBe(false)
    expect(isFriendUpForChat(null, "online")).toBe(false)
    expect(isFriendUpForChat(undefined, "online")).toBe(false)
  })
})

describe("canSayHi", () => {
  it("allows the first tap", () => {
    expect(canSayHi(undefined, 5)).toBe(true)
  })
  it("blocks a second tap inside 60 seconds", () => {
    expect(canSayHi(1000, 1000)).toBe(false)
    expect(canSayHi(1000, 1000 + SAY_HI_GUARD_MS - 1)).toBe(false)
  })
  it("allows another after 60 seconds", () => {
    expect(canSayHi(1000, 1000 + SAY_HI_GUARD_MS)).toBe(true)
  })
})
