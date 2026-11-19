/** The sign-in window's per-device choices (Req 13.2-13.4). */
export interface SignInOptions {
  /** Keep the session for the next start and skip the sign-in window. */
  autoSignIn: boolean
  /** Start every session as Invisible. */
  signInInvisible: boolean
}

export const DEFAULT_SIGN_IN_OPTIONS: SignInOptions = { autoSignIn: true, signInInvisible: false }

/** Reads saved options; anything missing or damaged falls back to its default. */
export function parseSignInOptions(raw: string | null): SignInOptions {
  let value: unknown = null
  try {
    value = raw === null ? null : JSON.parse(raw)
  } catch {
    value = null
  }
  const obj = value !== null && typeof value === "object" && !Array.isArray(value) ? value : {}
  const pick = (key: keyof SignInOptions): boolean => {
    const v: unknown = (obj as Record<string, unknown>)[key]
    return typeof v === "boolean" ? v : DEFAULT_SIGN_IN_OPTIONS[key]
  }
  return { autoSignIn: pick("autoSignIn"), signInInvisible: pick("signInInvisible") }
}

/**
 * With "Sign in automatically" off, a session left over from an earlier run
 * is dropped at start-up, so the user signs in again (Req 13.3). A session
 * started in this run (including after a reload) is kept.
 */
export function shouldDiscardSession(input: { autoSignIn: boolean; startedThisRun: boolean }): boolean {
  return !input.autoSignIn && !input.startedThisRun
}
