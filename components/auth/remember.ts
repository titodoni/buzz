import { parseSignInOptions, type SignInOptions } from "@/lib/auth/options"

const KEY = "buzz.rememberedEmail"

/** Only the email is ever stored, never the password. */
export function loadRememberedEmail(): string {
  try {
    return window.localStorage.getItem(KEY) ?? ""
  } catch {
    return ""
  }
}

export function saveRememberedEmail(email: string | null): void {
  try {
    if (email) window.localStorage.setItem(KEY, email)
    else window.localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable; ignore.
  }
}

const OPTIONS_KEY = "buzz.signInOptions"
const RUN_KEY = "buzz.runStarted"

/** The sign-in window's checkboxes, saved on this device. */
export function loadSignInOptions(): SignInOptions {
  try {
    return parseSignInOptions(window.localStorage.getItem(OPTIONS_KEY))
  } catch {
    return parseSignInOptions(null)
  }
}

export function saveSignInOptions(options: SignInOptions): void {
  try {
    window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
  } catch {
    // Storage unavailable; the defaults apply next time.
  }
}

/**
 * Marks that a session is in use during this run of the app. sessionStorage
 * lives as long as the window's page session, so the mark is gone after the
 * app restarts, which is what "Sign in automatically" off relies on.
 */
export function markRunStarted(): void {
  try {
    window.sessionStorage.setItem(RUN_KEY, "1")
  } catch {
    // Unavailable: we can't tell runs apart, so we keep the session.
  }
}

export function hasRunStarted(): boolean {
  try {
    return window.sessionStorage.getItem(RUN_KEY) === "1"
  } catch {
    return true // fail toward keeping the user signed in
  }
}
