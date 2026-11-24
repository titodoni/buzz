import { describe, it, expect } from "vitest"
import { acceptInboundNudge, INBOUND_MIN_GAP_MS, type InboundLog } from "../inbound"

describe("acceptInboundNudge", () => {
  it("accepts the first Buzz from a sender", () => {
    expect(acceptInboundNudge(new Map(), "a", 1000)).toBe(true)
  })

  it("ignores a Buzz that comes sooner than an honest app could send it", () => {
    const log: InboundLog = new Map()
    acceptInboundNudge(log, "a", 1000)
    expect(acceptInboundNudge(log, "a", 1000 + INBOUND_MIN_GAP_MS - 1)).toBe(false)
  })

  it("accepts the next Buzz once the gap has passed", () => {
    const log: InboundLog = new Map()
    acceptInboundNudge(log, "a", 1000)
    expect(acceptInboundNudge(log, "a", 1000 + INBOUND_MIN_GAP_MS)).toBe(true)
  })

  it("keeps each sender separate", () => {
    const log: InboundLog = new Map()
    acceptInboundNudge(log, "a", 1000)
    expect(acceptInboundNudge(log, "b", 1001)).toBe(true)
  })

  it("does not extend the wait when a Buzz is ignored", () => {
    const log: InboundLog = new Map()
    acceptInboundNudge(log, "a", 1000)
    acceptInboundNudge(log, "a", 5000)
    expect(acceptInboundNudge(log, "a", 1000 + INBOUND_MIN_GAP_MS)).toBe(true)
  })
})
