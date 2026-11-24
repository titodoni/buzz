import { describe, it, expect } from "vitest"
import {
  NUDGE_LIMIT,
  NUDGE_LIMIT_MESSAGE,
  NUDGE_LIMIT_WINDOW_MS,
  canNudge,
  readSentLog,
  recordNudge,
} from "../limiter"

const NOW = 10_000_000
const min = (n: number) => n * 60_000

// Feature: buzz-trigger, Nudge extended (R4.5): 5 Nudges in 10 minutes, to anyone
describe("canNudge", () => {
  it("states the limit and the message from the spec", () => {
    expect(NUDGE_LIMIT).toBe(5)
    expect(NUDGE_LIMIT_WINDOW_MS).toBe(600_000)
    expect(NUDGE_LIMIT_MESSAGE).toBe("Wait a moment before Nudging again")
  })
  it("allows the first five and blocks the sixth", () => {
    let log: number[] = []
    for (let i = 0; i < 5; i++) {
      expect(canNudge(log, NOW + i * 15_000)).toBe(true)
      log = recordNudge(log, NOW + i * 15_000)
    }
    expect(canNudge(log, NOW + 5 * 15_000)).toBe(false)
  })
  it("frees a slot exactly 10 minutes after the oldest Nudge", () => {
    const log = [NOW, NOW + 1000, NOW + 2000, NOW + 3000, NOW + 4000]
    expect(canNudge(log, NOW + NUDGE_LIMIT_WINDOW_MS - 1)).toBe(false)
    expect(canNudge(log, NOW + NUDGE_LIMIT_WINDOW_MS)).toBe(true)
  })
  it("counts Nudges to different friends together", () => {
    // The log holds times only, not who: five to five different friends still block.
    expect(canNudge([NOW, NOW, NOW, NOW, NOW], NOW + 1)).toBe(false)
  })
})

describe("recordNudge", () => {
  it("adds the time and drops entries older than the window", () => {
    const log = recordNudge([NOW - min(11), NOW - min(1)], NOW)
    expect(log).toEqual([NOW - min(1), NOW])
  })
})

// The log lives in localStorage, so a read must survive anything stored there
describe("readSentLog", () => {
  it("reads a saved list and keeps only entries inside the window", () => {
    const raw = JSON.stringify([NOW - min(11), NOW - min(9), NOW - 1000])
    expect(readSentLog(raw, NOW)).toEqual([NOW - min(9), NOW - 1000])
  })
  it("treats missing or damaged values as an empty log", () => {
    for (const raw of [null, "", "soon", "{}", '"x"', "[1,"]) expect(readSentLog(raw, NOW)).toEqual([])
  })
  it("drops entries that are not finite numbers", () => {
    expect(readSentLog(JSON.stringify([NOW - 1000, "a", null, {}, true]), NOW)).toEqual([NOW - 1000])
  })
  it("clamps a future time to now, so a clock change cannot lock the button for long", () => {
    const log = readSentLog(JSON.stringify([NOW + min(60)]), NOW)
    expect(log).toEqual([NOW])
    expect(canNudge(log, NOW + NUDGE_LIMIT_WINDOW_MS)).toBe(true)
  })
  it("keeps only the latest five", () => {
    const raw = JSON.stringify(Array.from({ length: 9 }, (_, i) => NOW - i * 1000))
    expect(readSentLog(raw, NOW)).toHaveLength(NUDGE_LIMIT)
  })
})
