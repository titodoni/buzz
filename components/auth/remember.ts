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
