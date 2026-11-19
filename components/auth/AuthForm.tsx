"use client"

import { useEffect, useId, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { WindowFrame } from "@/components/WindowFrame"
import { signIn, signUp, MSG_CONFIRM_EMAIL } from "@/lib/auth/session"
import { isValidEmail, isValidPassword, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/validation/profile"
import { AboutDialog } from "@/components/AboutDialog"
import { MenuBar, type MenuDef } from "@/components/friends/MenuBar"
import {
  loadRememberedEmail,
  loadSignInOptions,
  markPresenceStarted,
  markRunStarted,
  saveRememberedEmail,
  saveSignInOptions,
} from "./remember"

export type AuthMode = "signin" | "signup"

const COPY = {
  signin: {
    title: "Buzz - Sign In",
    submit: "Sign In",
    busy: "Signing in...",
    altText: "New to Buzz?",
    altLabel: "Get a new account",
    altHref: "/signup/",
  },
  signup: {
    title: "Buzz - Sign Up",
    submit: "Sign Up",
    busy: "Creating account...",
    altText: "Already have an account?",
    altLabel: "Sign In",
    altHref: "/login/",
  },
} as const

export function AuthForm({ mode }: { mode: AuthMode }) {
  const copy = COPY[mode]
  const router = useRouter()
  const uid = useId()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [autoSignIn, setAutoSignIn] = useState(true)
  const [invisible, setInvisible] = useState(false)
  const [about, setAbout] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [formError, setFormError] = useState("")
  const [notice, setNotice] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (mode !== "signin") return
    let active = true
    // Deferred so the first render matches the static export (no hydration mismatch).
    queueMicrotask(() => {
      if (!active) return
      const saved = loadRememberedEmail()
      if (saved) {
        setEmail(saved)
        setRemember(true)
      }
      const options = loadSignInOptions()
      setAutoSignIn(options.autoSignIn)
      setInvisible(options.signInInvisible)
    })
    return () => {
      active = false
    }
  }, [mode])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    const trimmed = email.trim()
    setFormError("")
    setNotice("")
    const emailMsg = isValidEmail(trimmed) ? "" : "Enter an email like name@example.com."
    // Sign-in only checks presence; the server decides if credentials match (Req 1.9).
    const passwordMsg =
      mode === "signup"
        ? isValidPassword(password)
          ? ""
          : `Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`
        : password
          ? ""
          : "Enter your password."
    setEmailError(emailMsg)
    setPasswordError(passwordMsg)
    if (emailMsg || passwordMsg) return

    setSubmitting(true)
    try {
      if (mode === "signin") {
        const res = await signIn(trimmed, password)
        if (!res.ok) return setFormError(res.message)
        saveRememberedEmail(remember ? trimmed : null)
        saveSignInOptions({ autoSignIn, signInInvisible: invisible })
        // This session belongs to the current run, so start-up keeps it (Req 13.3).
        markRunStarted()
        router.replace("/")
      } else {
        const res = await signUp(trimmed, password)
        if (!res.ok) return setFormError(res.message)
        if (res.needsConfirmation) return setNotice(MSG_CONFIRM_EMAIL)
        markRunStarted()
        // A brand-new account starts Available, whatever this device chose before.
        markPresenceStarted()
        router.replace("/")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const menus: MenuDef[] = [
    {
      label: "Messenger",
      items:
        mode === "signin"
          ? [
              { label: "Get a New Account...", onSelect: () => router.push("/signup/") },
              { label: "Forgot Your Password?", onSelect: () => router.push("/forgot/") },
            ]
          : [{ label: "Sign In", onSelect: () => router.push("/login/") }],
    },
    { label: "Help", items: [{ label: "About Buzz", onSelect: () => setAbout(true) }] },
  ]
  const emailId = `${uid}-email`
  const passwordId = `${uid}-password`

  return (
    <WindowFrame title={copy.title} menuBar={<MenuBar menus={menus} />}>
      {about ? <AboutDialog onClose={() => setAbout(false)} /> : null}
      {/* The window frame spans the whole window at any size; the form stays a centered column. */}
      <div className="flex min-h-full items-center justify-center p-4">
        <form onSubmit={onSubmit} noValidate className="flex w-full max-w-sm flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={emailId} className="text-sm font-bold">
              Email
            </label>
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? `${emailId}-err` : undefined}
              className="rounded border border-gray-400 px-2 py-2"
            />
            {emailError && (
              <p id={`${emailId}-err`} className="text-sm text-red-700">
                {emailError}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={passwordId} className="text-sm font-bold">
              Password
            </label>
            <input
              id={passwordId}
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? `${passwordId}-err` : undefined}
              className="rounded border border-gray-400 px-2 py-2"
            />
            {passwordError && (
              <p id={`${passwordId}-err`} className="text-sm text-red-700">
                {passwordError}
              </p>
            )}
          </div>
          {mode === "signin" && (
            <fieldset className="m-0 flex flex-col gap-1 border-0 p-0 text-sm">
              <legend className="sr-only">Sign-in options</legend>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember my ID
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoSignIn} onChange={(e) => setAutoSignIn(e.target.checked)} />
                Sign in automatically
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={invisible} onChange={(e) => setInvisible(e.target.checked)} />
                Sign in as invisible to everyone
              </label>
            </fieldset>
          )}
          <div aria-live="polite" role="status" className="min-h-5 text-sm">
            {formError && <span className="text-red-700">{formError}</span>}
            {notice && <span>{notice}</span>}
          </div>
          <button type="submit" disabled={submitting} className="ym-button px-4 py-2 disabled:opacity-60">
            {submitting ? copy.busy : copy.submit}
          </button>
          <p className="m-0 text-sm">
            {copy.altText}{" "}
            <Link href={copy.altHref} className="text-ym-blue underline">
              {copy.altLabel}
            </Link>
          </p>
          {mode === "signin" && (
            <p className="m-0 text-sm">
              <Link href="/forgot/" className="text-ym-blue underline">
                Forgot your password?
              </Link>
            </p>
          )}
        </form>
      </div>
    </WindowFrame>
  )
}
