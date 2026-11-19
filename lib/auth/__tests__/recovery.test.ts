import { describe, it, expect } from "vitest"
import { normalizeRecoveryCode, recoveryFormErrors } from "../recovery"

describe("normalizeRecoveryCode (Req 13.6)", () => {
  it("keeps only the digits people paste with spaces or dashes", () => {
    expect(normalizeRecoveryCode(" 123 456 ")).toBe("123456")
    expect(normalizeRecoveryCode("123-456")).toBe("123456")
  })
})

describe("recoveryFormErrors (Req 13.6, 13.7)", () => {
  it("accepts a 6-digit code and an 8 to 128 character password", () => {
    expect(recoveryFormErrors("123456", "goodpass")).toEqual({})
    expect(recoveryFormErrors("123 456", "x".repeat(128))).toEqual({})
  })

  it("accepts the longer codes Supabase can be set to send", () => {
    expect(recoveryFormErrors("12345678", "goodpass")).toEqual({})
  })

  it("rejects a code that is too short, too long, or not digits", () => {
    for (const code of ["", "12345", "12345678901", "abcdef"]) {
      expect(recoveryFormErrors(code, "goodpass").code).toBe("Enter the code from the email.")
    }
  })

  it("rejects a password outside 8 to 128 characters", () => {
    expect(recoveryFormErrors("123456", "short").password).toBe("Password must be 8 to 128 characters.")
    expect(recoveryFormErrors("123456", "x".repeat(129)).password).toBe("Password must be 8 to 128 characters.")
  })
})

import { MSG_CODE_FAILED, MSG_TOO_MANY, mapRecoveryError } from "../recovery"

describe("mapRecoveryError (Req 13.7)", () => {
  it("says the code did not work when it is wrong or expired", () => {
    expect(mapRecoveryError({ code: "otp_expired", message: "Token has expired or is invalid" })).toBe(MSG_CODE_FAILED)
    expect(mapRecoveryError({ message: "Token has expired or is invalid" })).toBe(MSG_CODE_FAILED)
    expect(MSG_CODE_FAILED).toBe("That code didn't work. Check it, or send a new one.")
  })

  it("asks the user to wait when Supabase limits how often emails go out", () => {
    expect(mapRecoveryError({ code: "over_email_send_rate_limit", message: "x" })).toBe(MSG_TOO_MANY)
    expect(mapRecoveryError({ status: 429, message: "x" })).toBe(MSG_TOO_MANY)
  })

  it("falls back to a generic message", () => {
    expect(mapRecoveryError({ message: "boom" })).toBe("Something went wrong. Please try again.")
  })
})
