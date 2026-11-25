import { beforeEach, describe, expect, it, vi } from "vitest"

const signOutMock = vi.fn()
vi.mock("@/lib/supabase/browser-client", () => ({
  getSupabase: () => ({ auth: { signOut: signOutMock } }),
}))

import { signOut } from "../session"

describe("signOut", () => {
  beforeEach(() => signOutMock.mockReset())

  it("still ends this device's session when the server cannot be reached", async () => {
    // supabase-js keeps the local session when the logout request fails, and the
    // sign-in page then sends the user straight back to the Buddy List.
    signOutMock.mockImplementation(async (opts?: { scope?: string }) =>
      opts?.scope === "local" ? { error: null } : { error: new Error("fetch failed") },
    )
    const result = await signOut()
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" })
    expect(result.ok).toBe(true)
  })

  it("reports a failure only when even the local sign-out fails", async () => {
    signOutMock.mockResolvedValue({ error: new Error("storage broken") })
    expect((await signOut()).ok).toBe(false)
  })
})
