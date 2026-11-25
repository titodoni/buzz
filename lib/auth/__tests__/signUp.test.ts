import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const signUpMock = vi.fn()
  const updateEqMock = vi.fn()
  const updateMock = vi.fn(() => ({ eq: updateEqMock }))
  const fromMock = vi.fn(() => ({ update: updateMock }))
  const uploadAvatarMock = vi.fn()
  return { signUpMock, updateEqMock, updateMock, fromMock, uploadAvatarMock }
})

vi.mock("@/lib/supabase/browser-client", () => ({
  getSupabase: () => ({
    auth: { signUp: mocks.signUpMock },
    from: mocks.fromMock,
  }),
}))

vi.mock("../../profile/api", () => ({
  uploadAvatar: mocks.uploadAvatarMock,
}))

import { signUp } from "../session"

describe("signUp", () => {
  beforeEach(() => {
    mocks.signUpMock.mockReset()
    mocks.updateEqMock.mockReset()
    mocks.updateMock.mockClear()
    mocks.fromMock.mockClear()
    mocks.uploadAvatarMock.mockReset()
  })

  it("rejects an invalid avatar before calling auth.signUp", async () => {
    const badFile = new File(["x"], "bad.gif", { type: "image/gif" })
    const res = await signUp("ann@buzz.test", "password123", { displayName: "Ann", avatarFile: badFile })
    expect(res.ok).toBe(false)
    expect(mocks.signUpMock).not.toHaveBeenCalled()
  })

  it("sends trimmed display_name in user metadata, updates profile, and uploads avatar when signed in", async () => {
    mocks.signUpMock.mockResolvedValue({
      data: { user: { id: "u1", identities: [{}] }, session: { access_token: "tok" } },
      error: null,
    })
    mocks.updateEqMock.mockResolvedValue({ error: null })
    mocks.uploadAvatarMock.mockResolvedValue({ ok: true, url: "https://example.test/u1/a.png" })

    const png = new File(["png"], "pic.png", { type: "image/png" })
    const res = await signUp("ann@buzz.test", "password123", { displayName: "  Ann Lee  ", avatarFile: png })

    expect(mocks.signUpMock).toHaveBeenCalledWith({
      email: "ann@buzz.test",
      password: "password123",
      options: { data: { display_name: "Ann Lee" } },
    })
    expect(mocks.fromMock).toHaveBeenCalledWith("profiles")
    expect(mocks.updateMock).toHaveBeenCalledWith({ display_name: "Ann Lee" })
    expect(mocks.updateEqMock).toHaveBeenCalledWith("id", "u1")
    expect(mocks.uploadAvatarMock).toHaveBeenCalledWith("u1", png)
    expect(res).toEqual({ ok: true, needsConfirmation: false })
  })
})
