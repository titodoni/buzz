"use client"

import { useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"

import { getSupabase } from "@/lib/supabase/browser-client"
import { uploadAvatar } from "../profile/api"
import { checkAvatar } from "../validation/profile"
import { MSG_GENERIC, MSG_EMAIL_IN_USE, mapAuthError, mapThrownError } from "./errors"
import { mapNewPasswordError, mapRecoveryError } from "./recovery"

export type AuthResult = { ok: true } | { ok: false; message: string }
export type SignUpResult =
  | { ok: true; needsConfirmation: boolean; avatarError?: string }
  | { ok: false; message: string }

export interface SignUpOptions {
  displayName?: string
  avatarFile?: File | null
}

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

export async function signUp(
  email: string,
  password: string,
  opts: SignUpOptions = {},
): Promise<SignUpResult> {
  if (opts.avatarFile) {
    const check = checkAvatar(opts.avatarFile)
    if (!check.ok) return { ok: false, message: check.reason ?? "That picture can't be used." }
  }
  const trimmedName = opts.displayName?.trim() ?? ""
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      ...(trimmedName ? { options: { data: { display_name: trimmedName } } } : {}),
    })
    if (error) return { ok: false, message: mapAuthError(error) }
    // With confirmation enabled, an existing email returns an obfuscated user with no identities.
    if (data.user && (data.user.identities?.length ?? 1) === 0) {
      return { ok: false, message: MSG_EMAIL_IN_USE }
    }
    if (data.session && data.user) {
      if (trimmedName) {
        // Also persist directly so sign-up sets Display Name even before the trigger migration is applied.
        await supabase.from("profiles").update({ display_name: trimmedName }).eq("id", data.user.id)
      }
      if (opts.avatarFile) {
        const up = await uploadAvatar(data.user.id, opts.avatarFile)
        if (!up.ok) return { ok: true, needsConfirmation: false, avatarError: up.message }
      }
    }
    return { ok: true, needsConfirmation: !data.session }
  } catch (e) {
    return { ok: false, message: mapThrownError(e) }
  }
}

export async function signOut(): Promise<AuthResult> {
  try {
    const supabase = getSupabase()
    const { error } = await supabase.auth.signOut()
    if (!error) return { ok: true }
    // supabase-js keeps the stored session when the server logout request fails
    // (offline, firewall, timeout), and the sign-in page would send the user
    // straight back in. Drop this device's session regardless.
    const local = await supabase.auth.signOut({ scope: "local" })
    if (local.error) return { ok: false, message: MSG_GENERIC }
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

/**
 * Checks the emailed code (Req 13.6). On success the user is signed in, which
 * is what lets them set the new password; the code can't be used twice.
 */
export async function verifyRecoveryCode(email: string, code: string): Promise<AuthResult> {
  try {
    const { error } = await getSupabase().auth.verifyOtp({ email, token: code, type: "recovery" })
    if (error) return { ok: false, message: mapRecoveryError(error) }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: mapThrownError(e) }
  }
}

/** Sets the new password for the signed-in user, after the code was accepted. */
export async function setNewPassword(password: string): Promise<AuthResult> {
  try {
    const { error } = await getSupabase().auth.updateUser({ password })
    if (error) return { ok: false, message: mapNewPasswordError(error) }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: mapThrownError(e) }
  }
}
