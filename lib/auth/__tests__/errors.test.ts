import { describe, it, expect } from "vitest"
import { mapAuthError, MSG_EMAIL_IN_USE, MSG_GENERIC, MSG_INVALID_CREDENTIALS } from "../errors"

describe("mapAuthError", () => {
  it("maps invalid credentials by code", () => {
    expect(mapAuthError({ code: "invalid_credentials", message: "x" })).toBe(MSG_INVALID_CREDENTIALS)
  })
  it("maps invalid credentials by message", () => {
    expect(mapAuthError({ message: "Invalid login credentials" })).toBe(MSG_INVALID_CREDENTIALS)
  })
  it("maps already registered by code", () => {
    expect(mapAuthError({ code: "user_already_exists" })).toBe(MSG_EMAIL_IN_USE)
    expect(mapAuthError({ code: "email_exists" })).toBe(MSG_EMAIL_IN_USE)
  })
  it("maps already registered by message", () => {
    expect(mapAuthError({ message: "User already registered" })).toBe(MSG_EMAIL_IN_USE)
  })
  it("falls back to a generic message", () => {
    expect(mapAuthError({ message: "boom" })).toBe(MSG_GENERIC)
    expect(mapAuthError(null)).toBe(MSG_GENERIC)
    expect(mapAuthError({})).toBe(MSG_GENERIC)
  })
})
