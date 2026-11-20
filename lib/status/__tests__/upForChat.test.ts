import { describe, it, expect } from "vitest"
import {
  upForChatKey,
  UP_FOR_CHAT_MS,
  UP_FOR_CHAT_TEXT,
  clearUpForChat,
  evaluateUpForChat,
  loadUpForChat,
  parseUpForChat,
  saveUpForChat,
  startUpForChat,
  type CurrentStatus,
} from "../upForChat"

// Feature: buzz-trigger, Up for Chat timer and restore rules (R2.2, R2.4)
const on: CurrentStatus = { text: UP_FOR_CHAT_TEXT, availability: "online" }
const T0 = 1_000_000

describe("startUpForChat", () => {
  it("remembers the old Status", () => {
    expect(startUpForChat("Out to Lunch", T0)).toEqual({ startedAt: T0, previousText: "Out to Lunch" })
  })
  it("remembers empty as null", () => {
    expect(startUpForChat(null, T0).previousText).toBeNull()
    expect(startUpForChat("   ", T0).previousText).toBeNull()
  })
  it("never remembers its own line", () => {
    expect(startUpForChat(UP_FOR_CHAT_TEXT, T0).previousText).toBeNull()
  })
})

describe("evaluateUpForChat", () => {
  const state = startUpForChat("brb", T0)

  it("does nothing without a state", () => {
    expect(evaluateUpForChat(null, on, T0)).toEqual({ type: "none" })
  })
  it("waits for the time left", () => {
    expect(evaluateUpForChat(state, on, T0 + 1000)).toEqual({ type: "wait", remainingMs: UP_FOR_CHAT_MS - 1000 })
  })
  it("restores the old Status at 60 minutes", () => {
    expect(evaluateUpForChat(state, on, T0 + UP_FOR_CHAT_MS)).toEqual({ type: "restore", text: "brb" })
  })
  it("restores empty when there was no old Status", () => {
    const empty = startUpForChat(null, T0)
    expect(evaluateUpForChat(empty, on, T0 + UP_FOR_CHAT_MS + 1)).toEqual({ type: "restore", text: null })
  })
  it("restores right away when the user taps off", () => {
    expect(evaluateUpForChat(state, on, T0 + 5, true)).toEqual({ type: "restore", text: "brb" })
  })
  it("drops when the user changed Status meanwhile, even after expiry", () => {
    const changed: CurrentStatus = { text: "Out to Lunch", availability: "busy" }
    expect(evaluateUpForChat(state, changed, T0 + 10)).toEqual({ type: "drop" })
    expect(evaluateUpForChat(state, changed, T0 + UP_FOR_CHAT_MS * 2)).toEqual({ type: "drop" })
  })
  it("drops when only Presence changed", () => {
    expect(evaluateUpForChat(state, { ...on, availability: "busy" }, T0 + 10)).toEqual({ type: "drop" })
  })
  it("drops when the user cleared the Status", () => {
    expect(evaluateUpForChat(state, { text: null, availability: "online" }, T0 + 10, true)).toEqual({ type: "drop" })
  })
  it("on next start, a state older than 60 minutes is cleared and the old Status returns", () => {
    expect(evaluateUpForChat(state, on, T0 + UP_FOR_CHAT_MS + 60_000)).toEqual({ type: "restore", text: "brb" })
  })
  it("on next start, a younger state resumes the timer", () => {
    expect(evaluateUpForChat(state, on, T0 + 10 * 60_000)).toEqual({
      type: "wait",
      remainingMs: UP_FOR_CHAT_MS - 10 * 60_000,
    })
  })
})

describe("storage", () => {
  const mem = () => {
    const m = new Map<string, string>()
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    }
  }

  it("round-trips and clears", () => {
    const s = mem()
    const state = startUpForChat("x", T0)
    saveUpForChat(s, "u1", state)
    expect(s.getItem(upForChatKey("u1"))).not.toBeNull()
    expect(loadUpForChat(s, "u1")).toEqual(state)
    expect(loadUpForChat(s, "u2")).toBeNull()
    clearUpForChat(s, "u1")
    expect(loadUpForChat(s, "u1")).toBeNull()
  })
  it("treats malformed values as none", () => {
    for (const raw of [null, "", "nope", "null", "[]", '{"startedAt":"1","previousText":null}', '{"startedAt":1,"previousText":5}']) {
      expect(parseUpForChat(raw)).toBeNull()
    }
  })
})
