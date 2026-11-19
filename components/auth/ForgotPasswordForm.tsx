"use client"
import { useId, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { WindowFrame } from "@/components/WindowFrame"
import { MSG_PASSWORD, MSG_TOO_MANY, normalizeRecoveryCode, recoveryFormErrors } from "@/lib/auth/recovery"
import { sendRecoveryCode, setNewPassword, verifyRecoveryCode } from "@/lib/auth/session"
import { isValidEmail, isValidPassword } from "@/lib/validation/profile"
import { markRunStarted } from "./remember"

/**
 * Password recovery by emailed code (Req 13.5-13.7). A desktop app has no web
 * address for an emailed link to open, so the user types the code instead.
 */
export function ForgotPasswordForm() {
  const router = useRouter()
  const uid = useId()
  // "password": the code was accepted but the new password wasn't saved yet.
  const [step, setStep] = useState<"email" | "code" | "password">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string }>({})
  const [formError, setFormError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)

  async function sendCode(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault()
    if (busy) return
    const trimmed = email.trim()
    setFormError("")
    if (!isValidEmail(trimmed)) {
      setErrors({ email: "Enter an email like name@example.com." })
      return
    }
    setErrors({})
    setBusy(true)
    const res = await sendRecoveryCode(trimmed)
    setBusy(false)
    // Supabase only rate-limits resends for real accounts, so "too many" is
    // answered like a success: the same words whether or not the email has an
    // account, so nobody can probe for one.
    if (!res.ok && res.message !== MSG_TOO_MANY) return setFormError(res.message)
    setStep("code")
    setNotice(
      `If ${trimmed} has a Buzz account, we've emailed it a code. If you just asked for one, wait a minute before asking again.`,
    )
  }

  async function reset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setFormError("")
    if (step === "password") {
      if (!isValidPassword(password)) return setErrors({ password: MSG_PASSWORD })
      setErrors({})
    } else {
      const fieldErrors = recoveryFormErrors(code, password)
      setErrors(fieldErrors)
      if (fieldErrors.code || fieldErrors.password) return
    }
    setBusy(true)
    if (step === "code") {
      const verified = await verifyRecoveryCode(email.trim(), normalizeRecoveryCode(code))
      if (!verified.ok) {
        setBusy(false)
        return setFormError(verified.message)
      }
      // The code is spent now; from here on only the password can be retried.
      setStep("password")
    }
    const saved = await setNewPassword(password)
    setBusy(false)
    if (!saved.ok) return setFormError(saved.message)
    markRunStarted()
    router.replace("/")
  }

  const id = (name: string) => `${uid}-${name}`
  return (
    <WindowFrame title="Buzz - Forgot Password">
      <div className="flex min-h-full items-center justify-center p-4">
        {step === "email" ? (
          <form onSubmit={sendCode} noValidate className="flex w-full max-w-sm flex-col gap-3">
            <p className="m-0 text-sm">Enter your email and we&apos;ll send you a code to set a new password.</p>
            <div className="flex flex-col gap-1">
              <label htmlFor={id("email")} className="text-sm font-bold">
                Email
              </label>
              <input
                id={id("email")}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? id("email-err") : undefined}
                className="px-2 py-2"
              />
              {errors.email && (
                <p id={id("email-err")} className="m-0 text-sm text-red-700">
                  {errors.email}
                </p>
              )}
            </div>
            <div role="status" aria-live="polite" className="min-h-5 text-sm text-red-700">
              {formError}
            </div>
            <button type="submit" disabled={busy} className="ym-button px-4 py-2 disabled:opacity-60">
              {busy ? "Sending..." : "Send Code"}
            </button>
            <p className="m-0 text-sm">
              <Link href="/login/" className="text-ym-blue underline">
                Back to sign in
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={reset} noValidate className="flex w-full max-w-sm flex-col gap-3">
            <p role="status" className="m-0 text-sm">
              {step === "password" ? "Your code worked. Now choose your new password." : notice}
            </p>
            {step === "code" ? (
            <div className="flex flex-col gap-1">
              <label htmlFor={id("code")} className="text-sm font-bold">
                Code from the email
              </label>
              <input
                id={id("code")}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-invalid={errors.code ? true : undefined}
                aria-describedby={errors.code ? id("code-err") : undefined}
                className="px-2 py-2"
              />
              {errors.code && (
                <p id={id("code-err")} className="m-0 text-sm text-red-700">
                  {errors.code}
                </p>
              )}
            </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <label htmlFor={id("password")} className="text-sm font-bold">
                New password
              </label>
              <input
                id={id("password")}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? id("password-err") : undefined}
                className="px-2 py-2"
              />
              {errors.password && (
                <p id={id("password-err")} className="m-0 text-sm text-red-700">
                  {errors.password}
                </p>
              )}
            </div>
            <div role="alert" className="min-h-5 text-sm text-red-700">
              {formError}
            </div>
            <button type="submit" disabled={busy} className="ym-button px-4 py-2 disabled:opacity-60">
              {busy ? "Saving..." : "Set New Password"}
            </button>
            <p className="m-0 flex flex-wrap gap-x-3 text-sm">
              {step === "code" ? (
              <button type="button" className="text-ym-blue cursor-pointer border-0 bg-transparent p-0 underline" onClick={() => void sendCode()}>
                Send a new code
              </button>
              ) : null}
              <Link href="/login/" className="text-ym-blue underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </WindowFrame>
  )
}
