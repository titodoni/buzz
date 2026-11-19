import { describe, it, expect } from "vitest"
import {
  mapAuthError,
  mapThrownError,
  MSG_EMAIL_IN_USE,
  MSG_GENERIC,
  MSG_INVALID_CREDENTIALS,
  MSG_NOT_CONFIGURED,
} from "../errors"
import { SupabaseConfigError } from "../../supabase/config-error"

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

describe("mapThrownError", () => {
  it("tells the user the app is not configured when Supabase settings are missing", () => {
    const e = new SupabaseConfigError(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"])
    expect(mapThrownError(e)).toBe(MSG_NOT_CONFIGURED)
  })
  it("falls back to the generic message for anything else", () => {
    expect(mapThrownError(new Error("network down"))).toBe(MSG_GENERIC)
    expect(mapThrownError("weird")).toBe(MSG_GENERIC)
  })
})
