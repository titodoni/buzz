import { SupabaseConfigError } from "../supabase/config-error"

export const MSG_INVALID_CREDENTIALS = "Invalid email or password."
export const MSG_EMAIL_IN_USE = "That email is already in use."
export const MSG_GENERIC = "Something went wrong. Please try again."
export const MSG_NOT_CONFIGURED =
  "Buzz isn't connected to its server yet. Add the Supabase project URL and publishable key to .env, then restart."

export interface AuthErrorLike {
  message?: string | null
  code?: string | null
}

/** Maps anything thrown while talking to Supabase to a friendly message. */
export function mapThrownError(error: unknown): string {
  return error instanceof SupabaseConfigError ? MSG_NOT_CONFIGURED : MSG_GENERIC
}

/** Maps a Supabase auth error to a plain, friendly message. */
export function mapAuthError(error: AuthErrorLike | null | undefined): string {
  if (!error) return MSG_GENERIC
  const code = (error.code ?? "").toLowerCase()
  const message = (error.message ?? "").toLowerCase()
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return MSG_INVALID_CREDENTIALS
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("already exists")
  ) {
    return MSG_EMAIL_IN_USE
  }
  return MSG_GENERIC
}
