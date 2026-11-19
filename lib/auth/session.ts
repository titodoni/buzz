"use client"

import { useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"

import { getSupabase } from "@/lib/supabase/browser-client"
import { MSG_GENERIC, MSG_EMAIL_IN_USE, mapAuthError, mapThrownError } from "./errors"
import { mapRecoveryError } from "./recovery"

export type AuthResult = { ok: true } | { ok: false; message: string }
export type SignUpResult =
  | { ok: true; needsConfirmation: boolean }
  | { ok: false; message: string }

export const MSG_CONFIRM_EMAIL = "Check your email to confirm your account."

export function useSession(): { session: Session | null; user: User | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let supabase: ReturnType<typeof getSupabase>
    try {
      supabase = getSupabase()
    } catch {
      // Missing config: treat as signed out so the login page still renders.
      queueMicrotask(() => {
        if (active) setLoading(false)
      })
      return () => {
        active = false
      }
    }
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      setLoading(false)
    })
    supabase.auth
      .getSession()
      .then(({ data: res }) => {
        if (!active) return
        setSession(res.session)
        setLoading(false)
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return { session, user: session?.user ?? null, loading }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) return { ok: false, message: mapAuthError(error) }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: mapThrownError(e) }
  }
}

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  try {
    const { data, error } = await getSupabase().auth.signUp({ email, password })
    if (error) return { ok: false, message: mapAuthError(error) }
    // With confirmation enabled, an existing email returns an obfuscated user with no identities.
    if (data.user && (data.user.identities?.length ?? 1) === 0) {
      return { ok: false, message: MSG_EMAIL_IN_USE }
    }
    return { ok: true, needsConfirmation: !data.session }
  } catch (e) {
    return { ok: false, message: mapThrownError(e) }
  }
}

export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await getSupabase().auth.signOut()
    if (error) return { ok: false, message: MSG_GENERIC }
    return { ok: true }
  } catch {
    return { ok: false, message: MSG_GENERIC }
  }
}

/** Drops this device's session without signing out other devices. */
export async function discardLocalSession(): Promise<void> {
  try {
    await getSupabase().auth.signOut({ scope: "local" })
  } catch {
    // Nothing stored or not configured: already signed out here.
  }
}

/**
 * Sends a recovery email with a one-time code (Req 13.5). Supabase answers the
 * same way for unknown emails, so this never reveals who has an account.
 */
export async function sendRecoveryCode(email: string): Promise<AuthResult> {
  try {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email)
    if (error) return { ok: false, message: mapRecoveryError(error) }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: mapThrownError(e) }
  }
}

/** Checks the emailed code, then sets the new password; the user ends up signed in (Req 13.6). */
export async function resetPasswordWithCode(email: string, code: string, password: string): Promise<AuthResult> {
  try {
    const supabase = getSupabase()
    const verified = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" })
    if (verified.error) return { ok: false, message: mapRecoveryError(verified.error) }
    const updated = await supabase.auth.updateUser({ password })
    if (updated.error) return { ok: false, message: mapRecoveryError(updated.error) }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: mapThrownError(e) }
  }
}
