import { describe, it, expect } from "vitest"
import {
  HANGOUT_EXPIRY_MS,
  busyHint,
  chatLines,
  effectiveStatus,
  hasPendingWith,
  incomingPending,
  sendBlockReason,
  systemLine,
} from "../state"

const T0 = Date.parse("2026-11-25T10:00:00.000Z")
const row = (status: "pending" | "accepted" | "declined" | "expired", created = T0) => ({
  status,
  created_at: new Date(created).toISOString(),
})

// Feature: buzz-trigger, Hangout (R3.5): a pending Hangout expires after 15 minutes
describe("effectiveStatus", () => {
  it("stays pending just under 15 minutes", () => {
    expect(HANGOUT_EXPIRY_MS).toBe(900_000)
    expect(effectiveStatus(row("pending"), T0 + 899_999)).toBe("pending")
  })
  it("is expired at exactly 15 minutes, even if the cron job has not run yet", () => {
    expect(effectiveStatus(row("pending"), T0 + 900_000)).toBe("expired")
  })
  it("never changes an answered Hangout", () => {
    for (const s of ["accepted", "declined", "expired"] as const)
      expect(effectiveStatus(row(s), T0 + 10 * HANGOUT_EXPIRY_MS)).toBe(s)
  })
})

// R3.6, R3.8: why the Hangout button is not usable
describe("sendBlockReason", () => {
  it("is null when the friend is reachable and nothing is pending", () => {
    for (const p of ["online", "away", "busy"] as const)
      expect(sendBlockReason(p, false)).toBeNull()
  })
  it("says offline when the friend is Offline", () => {
    expect(sendBlockReason("offline", false)).toBe("offline")
  })
  it("says pending when one is already waiting", () => {
    expect(sendBlockReason("online", true)).toBe("pending")
  })
  it("reports Offline first when both apply", () => {
    expect(sendBlockReason("offline", true)).toBe("offline")
  })
})

// R3.3 to R3.5: what each person reads once a Hangout is answered
describe("systemLine", () => {
  const ann = "ann-id"
  const bob = "bob-id"
  const names = { [ann]: "Ann", [bob]: "Bob" }
  // Ann sent the Hangout, Bob received it.
  const h = (status: "pending" | "accepted" | "declined" | "expired") => ({
    status,
    sender_id: ann,
    receiver_id: bob,
    text: "Play a game?",
    created_at: new Date(T0).toISOString(),
  })
  const now = T0 + 1000

  it("shows nothing while pending", () => {
    expect(systemLine(h("pending"), ann, names, now)).toBeNull()
    expect(systemLine(h("pending"), bob, names, now)).toBeNull()
  })
  it("tells both sides who accepted, with the text", () => {
    expect(systemLine(h("accepted"), ann, names, now)).toBe("Bob accepted: Play a game?")
    expect(systemLine(h("accepted"), bob, names, now)).toBe("Bob accepted: Play a game?")
  })
  it("tells only the sender about a decline", () => {
    expect(systemLine(h("declined"), ann, names, now)).toBe("Hangout declined")
    expect(systemLine(h("declined"), bob, names, now)).toBeNull()
  })
  it("tells both sides about an expiry, including a pending row past 15 minutes", () => {
    expect(systemLine(h("expired"), ann, names, now)).toBe("Hangout expired")
    expect(systemLine(h("expired"), bob, names, now)).toBe("Hangout expired")
    expect(systemLine(h("pending"), ann, names, T0 + HANGOUT_EXPIRY_MS)).toBe("Hangout expired")
  })
  it("falls back to a plain word when the name is unknown", () => {
    expect(systemLine(h("accepted"), ann, {}, now)).toBe("Your friend accepted: Play a game?")
  })
})

// R3.7: a Busy friend still gets it, and the sender is told
describe("busyHint", () => {
  it("shows only for a Busy friend", () => {
    expect(busyHint("busy")).toBe("Your friend is busy")
    for (const p of ["online", "away", "offline"] as const) expect(busyHint(p)).toBeNull()
  })
})

// What the Buddy List banner and the Chat Window read from the loaded rows
describe("incomingPending, hasPendingWith, chatLines", () => {
  const me = "me"
  const ann = "ann"
  const bob = "bob"
  const mk = (id: string, from: string, to: string, status: "pending" | "accepted" | "declined" | "expired", minutesAgo: number) => ({
    id,
    status,
    sender_id: from,
    receiver_id: to,
    text: `text ${id}`,
    created_at: new Date(T0 - minutesAgo * 60_000).toISOString(),
  })
  const rows = [
    mk("1", ann, me, "pending", 2),
    mk("2", bob, me, "pending", 1),
    mk("3", me, ann, "pending", 3),
    mk("4", ann, me, "pending", 20), // older than 15 minutes: reads as expired
    mk("5", ann, me, "declined", 5),
  ]
  const names = { me: "Me", ann: "Ann", bob: "Bob" }

  it("lists only unexpired Hangouts sent to me, newest first", () => {
    expect(incomingPending(rows, me, T0).map((r) => r.id)).toEqual(["2", "1"])
  })
  it("knows whether a pair has a Hangout waiting, either direction, ignoring stale ones", () => {
    expect(hasPendingWith(rows, me, ann, T0)).toBe(true) // 1 and 3
    expect(hasPendingWith(rows, me, bob, T0)).toBe(true)
    expect(hasPendingWith(rows.filter((r) => r.id === "4" || r.id === "5"), me, ann, T0)).toBe(false)
  })
  it("builds the lines for one chat, oldest first, skipping pending ones and the receiver's decline", () => {
    // 4 expired by age (both sides see it); 5 declined: I am the receiver, so no line.
    expect(chatLines(rows, me, ann, names, T0)).toEqual([{ id: "4", text: "Hangout expired" }])
  })
  it("shows the sender a decline", () => {
    const mine = [mk("6", me, ann, "declined", 1)]
    expect(chatLines(mine, me, ann, names, T0)).toEqual([{ id: "6", text: "Hangout declined" }])
  })
})
