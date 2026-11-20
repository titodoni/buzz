import { describe, it, expect } from "vitest"
import {
  PAUSE_GRACE_MS,
  WRITE_EVERY_MS,
  decideAuto,
  formatTrack,
  initAuto,
  stepAuto,
  type AutoEvent,
  type AutoState,
} from "../auto"

const none = { manual: null, lastAuto: null }
const run = (s: AutoState, ...events: AutoEvent[]) => events.reduce(stepAuto, s)

describe("formatTrack (R7.2)", () => {
  it("joins artist and title, or uses the title alone", () => {
    expect(formatTrack(["Daft Punk", "One More Time"])).toBe("Daft Punk - One More Time")
    expect(formatTrack([null, "Lo-fi beats"])).toBe("Lo-fi beats")
    expect(formatTrack(["  ", "Video"])).toBe("Video")
  })

  it("is null for nothing playing or an empty title", () => {
    expect(formatTrack(null)).toBeNull()
    expect(formatTrack(["A", "  "])).toBeNull()
  })

  it("cuts to 140 characters without splitting a character", () => {
    expect([...(formatTrack([null, "é".repeat(200)]) ?? "")]).toHaveLength(140)
  })
})

describe("decideAuto (R7.2 to R7.5)", () => {
  it("writes a new track straight away", () => {
    const s = run(initAuto(null, none), { type: "track", line: "A - B", now: 0 })
    expect(decideAuto(s, 0)).toEqual({ kind: "write", line: "A - B" })
  })

  it("does nothing when the profile already shows the line", () => {
    const s = run(initAuto("A - B", none), { type: "track", line: "A - B", now: 0 })
    expect(decideAuto(s, 0)).toEqual({ kind: "none" })
  })

  it("waits 30 seconds after a stop, then restores the hand-typed line", () => {
    let s = initAuto("my own line", none)
    s = run(s, { type: "track", line: "A - B", now: 0 }, { type: "written", line: "A - B", now: 0 })
    s = run(s, { type: "track", line: null, now: 20_000 })
    expect(decideAuto(s, 25_000)).toEqual({ kind: "wait", at: 20_000 + PAUSE_GRACE_MS })
    expect(decideAuto(s, 20_000 + PAUSE_GRACE_MS)).toEqual({ kind: "write", line: "my own line" })
  })

  it("clears after a stop when there was no hand-typed line", () => {
    let s = run(initAuto(null, none), { type: "track", line: "A - B", now: 0 }, { type: "written", line: "A - B", now: 0 })
    s = run(s, { type: "track", line: null, now: 1_000 })
    expect(decideAuto(s, 1_000 + PAUSE_GRACE_MS)).toEqual({ kind: "write", line: null })
  })

  it("a resume inside the grace period writes nothing", () => {
    let s = run(initAuto(null, none), { type: "track", line: "A - B", now: 0 }, { type: "written", line: "A - B", now: 0 })
    s = run(s, { type: "track", line: null, now: 15_000 }, { type: "track", line: "A - B", now: 20_000 })
    expect(decideAuto(s, 60_000)).toEqual({ kind: "none" })
  })

  it("writes at most once every 10 seconds", () => {
    let s = run(initAuto(null, none), { type: "track", line: "one", now: 0 }, { type: "written", line: "one", now: 0 })
    s = run(s, { type: "track", line: "two", now: 4_000 })
    expect(decideAuto(s, 4_000)).toEqual({ kind: "wait", at: WRITE_EVERY_MS })
    expect(decideAuto(s, WRITE_EVERY_MS)).toEqual({ kind: "write", line: "two" })
  })

  it("a hand-typed line wins until the next track change (R7.4)", () => {
    let s = run(initAuto(null, none), { type: "track", line: "one", now: 0 }, { type: "written", line: "one", now: 0 })
    s = run(s, { type: "manual", line: "typed" })
    expect(decideAuto(s, 60_000)).toEqual({ kind: "none" })
    s = run(s, { type: "track", line: "one", now: 61_000 })
    expect(decideAuto(s, 61_000)).toEqual({ kind: "none" })
    s = run(s, { type: "track", line: "two", now: 62_000 })
    expect(decideAuto(s, 62_000)).toEqual({ kind: "write", line: "two" })
  })
})

describe("initAuto", () => {
  it("treats a profile line Buzz wrote itself as automatic, keeping the saved hand-typed one", () => {
    expect(initAuto("A - B", { manual: "mine", lastAuto: "A - B" }).manual).toBe("mine")
  })

  it("treats any other profile line as hand-typed", () => {
    expect(initAuto("typed on another computer", { manual: "old", lastAuto: "A - B" }).manual).toBe(
      "typed on another computer",
    )
  })
})
