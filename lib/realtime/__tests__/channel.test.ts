import { describe, it, expect, vi, beforeEach } from "vitest"

// A fake supabase-js client: like the real one, `channel(name)` hands back the
// same object for a topic until that channel has been removed.
const live = new Map<string, { name: string }>()
const fake = {
  channel: (name: string) => {
    const existing = live.get(name)
    if (existing) return existing
    const ch = { name }
    live.set(name, ch)
    return ch
  },
  removeChannel: async (ch: { name: string }) => {
    live.delete(ch.name)
    return "ok"
  },
}
vi.mock("../../supabase/browser-client", () => ({ getSupabase: () => fake }))

const { openChannel, closeChannel } = await import("../channel")

beforeEach(() => live.clear())

describe("closeChannel and openChannel", () => {
  it("a reopen during a slow untrack waits and gets a new channel (Buddy List remount)", async () => {
    // The fake channel stands in for a RealtimeChannel; only identity matters here.
    const first = (await openChannel("presence:global")) as unknown as { name: string }
    let finishUntrack: () => void = () => {}
    const untrack = () => new Promise<void>((r) => (finishUntrack = r))

    const closing = closeChannel("presence:global", first as never, untrack)
    let reopened = false
    const reopening = openChannel("presence:global").then((ch) => {
      reopened = true
      return ch
    })
    for (let i = 0; i < 10; i++) await Promise.resolve()
    expect(reopened).toBe(false) // still waiting: the old channel is not handed out mid-untrack
    finishUntrack()
    await closing
    const second = await reopening
    expect(second).not.toBe(first)
  })

  it("still removes the channel when the untrack fails", async () => {
    const ch = await openChannel("t")
    await closeChannel("t", ch as never, () => Promise.reject(new Error("offline")))
    expect(live.has("t")).toBe(false)
  })
})
