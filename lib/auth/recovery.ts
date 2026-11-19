import { PASSWORD_MAX, PASSWORD_MIN, isValidPassword } from "../validation/profile"

// Supabase sends a 6-digit code by default; a project can raise it, so we
// accept 6 to 10 digits and let the server decide whether it matches.
const CODE = /^\d{6,10}$/

export const MSG_CODE = "Enter the code from the email."
export const MSG_PASSWORD = `Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`

/** Keeps only the digits, so a code pasted with spaces or dashes still works. */
export function normalizeRecoveryCode(input: string): string {
  return input.replace(/\D/g, "")
}

/** Field errors for the reset form; an empty object means it can be sent. */
export function recoveryFormErrors(code: string, password: string): { code?: string; password?: string } {
  const errors: { code?: string; password?: string } = {}
  // Validate what the user typed, after removing separators (not other characters).
  const typed = code.replace(/[\s-]/g, "")
  if (!CODE.test(typed)) errors.code = MSG_CODE
  if (!isValidPassword(password)) errors.password = MSG_PASSWORD
  return errors
}

export const MSG_CODE_FAILED = "That code didn't work. Check it, or send a new one."
export const MSG_TOO_MANY = "Too many tries. Wait a minute, then try again."
const MSG_GENERIC = "Something went wrong. Please try again."

/** Maps a Supabase error from sending or checking a recovery code to plain words. */
export function mapRecoveryError(error: { code?: string | null; message?: string | null; status?: number | null }): string {
  const code = (error.code ?? "").toLowerCase()
  const message = (error.message ?? "").toLowerCase()
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error.status === 429) {
    return MSG_TOO_MANY
  }
  if (code === "otp_expired" || code === "otp_disabled" || message.includes("expired") || message.includes("invalid")) {
    return MSG_CODE_FAILED
  }
  return MSG_GENERIC
}

export const MSG_PASSWORD_REUSED = "Pick a password you haven't used here before."
export const MSG_PASSWORD_WEAK = "That password is too easy to guess. Try a longer one."

/**
 * Maps an error from saving the new password. The code was already accepted
 * at that point, so this never says the code failed.
 */
export function mapNewPasswordError(error: { code?: string | null; message?: string | null }): string {
  const code = (error.code ?? "").toLowerCase()
  if (code === "same_password") return MSG_PASSWORD_REUSED
  if (code === "weak_password") return MSG_PASSWORD_WEAK
  return MSG_GENERIC
}
