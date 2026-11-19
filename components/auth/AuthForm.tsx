"use client"

import { useEffect, useId, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { WindowFrame } from "@/components/WindowFrame"
import { signIn, signUp, MSG_CONFIRM_EMAIL } from "@/lib/auth/session"
import { isValidEmail, isValidPassword, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/validation/profile"
import { loadRememberedEmail, saveRememberedEmail } from "./remember"

export type AuthMode = "signin" | "signup"

const COPY = {
  signin: {
    title: "Buzz - Sign In",
    submit: "Sign In",
    busy: "Signing in...",
    altText: "New to Buzz?",
    altLabel: "Sign Up",
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
      const saved = loadRememberedEmail()
      if (active && saved) {
        setEmail(saved)
        setRemember(true)
      }
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
        router.replace("/")
      } else {
        const res = await signUp(trimmed, password)
        if (!res.ok) return setFormError(res.message)
        if (res.needsConfirmation) return setNotice(MSG_CONFIRM_EMAIL)
        router.replace("/")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const emailId = `${uid}-email`
  const passwordId = `${uid}-password`

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <WindowFrame title={copy.title} className="w-full max-w-sm">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 p-4">
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
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember my ID
            </label>
          )}
          <div aria-live="polite" role="status" className="min-h-5 text-sm">
            {formError && <span className="text-red-700">{formError}</span>}
            {notice && <span>{notice}</span>}
          </div>
          <button type="submit" disabled={submitting} className="ym-button px-4 py-2 disabled:opacity-60">
            {submitting ? copy.busy : copy.submit}
          </button>
          <p className="text-sm">
            {copy.altText}{" "}
            <Link href={copy.altHref} className="text-ym-blue underline">
              {copy.altLabel}
            </Link>
          </p>
        </form>
      </WindowFrame>
    </div>
  )
}
