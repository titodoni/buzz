"use client"

import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { WindowFrame } from "@/components/WindowFrame"
import { signIn, signUp, MSG_CONFIRM_EMAIL } from "@/lib/auth/session"
import { setProfileNotice } from "@/lib/profile/notice"
import { MSG_NAME_TOO_LONG } from "@/lib/profile/save"
import {
  AVATAR_TYPES,
  DISPLAY_NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  checkAvatar,
  isValidDisplayName,
  isValidEmail,
  isValidPassword,
} from "@/lib/validation/profile"
import { BuzzHero } from "@/components/BuzzHero"
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
    title: "Buzz! - Sign In",
    submit: "Sign In",
    busy: "Signing in...",
    altText: "New to Buzz?",
    altLabel: "Get a new account",
    altHref: "/signup/",
  },
  signup: {
    title: "Buzz! - Sign Up",
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
  const [displayName, setDisplayName] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState("")
  const [displayNameError, setDisplayNameError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  function onPickAvatar(file: File | undefined) {
    if (!file) return
    const check = checkAvatar(file)
    if (!check.ok) {
      setAvatarError(check.reason ?? "That picture can't be used.")
      return
    }
    setAvatarError("")
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function clearAvatar() {
    setAvatarFile(null)
    setAvatarPreview(null)
    setAvatarError("")
  }

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
    const trimmedName = displayName.trim()
    setFormError("")
    setNotice("")
    setAvatarError("")
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
    const nameMsg =
      mode === "signup"
        ? isValidDisplayName(trimmedName)
          ? ""
          : trimmedName.length === 0
            ? "Enter a display name."
            : MSG_NAME_TOO_LONG
        : ""
    setEmailError(emailMsg)
    setPasswordError(passwordMsg)
    setDisplayNameError(nameMsg)
    // A rejected picture is never kept in avatarFile, so its error must not block sign-up.
    if (emailMsg || passwordMsg || nameMsg) return

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
        const res = await signUp(trimmed, password, { displayName: trimmedName, avatarFile })
        if (!res.ok) return setFormError(res.message)
        if (res.needsConfirmation) return setNotice(MSG_CONFIRM_EMAIL)
        markRunStarted()
        // A brand-new account starts Available, whatever this device chose before.
        markPresenceStarted()
        if (res.avatarError) {
          setProfileNotice(`Your account is ready, but your picture didn't upload. ${res.avatarError}`)
          router.replace("/profile/")
        } else {
          router.replace("/")
        }
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
  const nameId = `${uid}-display-name`

  return (
    <WindowFrame title={copy.title} menuBar={<MenuBar menus={menus} />}>
      {about ? <AboutDialog onClose={() => setAbout(false)} /> : null}
      {/* Open YM-style light gradient canvas with floating B! emblem and compact fields. */}
      <div className="ym-login-bg flex min-h-full flex-col">
        <div className="flex flex-col items-center px-3 pt-3">
          <BuzzHero height={mode === "signin" ? 116 : 92} />
          <div className="mt-0.5 text-center leading-none">
            <span
              className="block font-black tracking-tight"
              style={{
                fontFamily: 'Arial, "Liberation Sans", Helvetica, sans-serif',
                fontSize: 21,
                color: "#5f1f9e",
                textShadow: "1px 1px 0 #d8c8f0",
              }}
            >
              Buzz!
            </span>
            <span
              className="mt-0.5 block font-bold uppercase"
              style={{
                fontFamily: 'Arial, "Liberation Sans", Helvetica, sans-serif',
                fontSize: 9.5,
                letterSpacing: 3.2,
                color: "#6b32ad",
              }}
            >
              MESSENGER
            </span>
          </div>
        </div>
        <div className="flex flex-1 items-start justify-center px-4 pt-3 pb-4">
        <form onSubmit={onSubmit} noValidate className="flex w-full max-w-sm flex-col gap-2.5">
          {mode === "signup" && (
            <div className="flex flex-col gap-1">
              <label htmlFor={nameId} className="text-xs font-bold">
                Display name
              </label>
              <input
                id={nameId}
                type="text"
                autoComplete="nickname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                aria-invalid={displayNameError ? true : undefined}
                aria-describedby={displayNameError ? `${nameId}-err` : undefined}
                className="rounded-sm border border-gray-400 px-2 py-1.5 text-sm"
              />
              <div className="flex justify-between text-xs">
                <span id={`${nameId}-err`} className="text-red-700">
                  {displayNameError}
                </span>
                <span>
                  {displayName.length}/{DISPLAY_NAME_MAX}
                </span>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor={emailId} className="text-xs font-bold">
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
              className="rounded-sm border border-gray-400 px-2 py-1.5 text-sm"
            />
            {emailError && (
              <p id={`${emailId}-err`} className="text-xs text-red-700">
                {emailError}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={passwordId} className="text-xs font-bold">
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
              className="rounded-sm border border-gray-400 px-2 py-1.5 text-sm"
            />
            {passwordError && (
              <p id={`${passwordId}-err`} className="text-xs text-red-700">
                {passwordError}
              </p>
            )}
          </div>
          {mode === "signup" && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold">Profile picture (optional)</span>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- static export, local preview or default avatar */}
                <img
                  src={avatarPreview ?? "/avatars/default.png"}
                  alt="Profile picture preview"
                  width={56}
                  height={56}
                  className="shrink-0 rounded border border-gray-400 object-cover"
                  style={{ width: 56, height: 56 }}
                />
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={AVATAR_TYPES.join(",")}
                    hidden
                    onChange={(e) => {
                      onPickAvatar(e.target.files?.[0])
                      e.target.value = ""
                    }}
                  />
                  <button type="button" className="ym-button" onClick={() => fileInputRef.current?.click()}>
                    Choose picture
                  </button>
                  {avatarFile ? (
                    <button type="button" className="ym-button" onClick={clearAvatar}>
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              <span className="text-xs">PNG, JPEG or WebP, up to 2 MB.</span>
              {avatarError ? (
                <p role="alert" className="text-sm text-red-700">
                  {avatarError}
                </p>
              ) : null}
            </div>
          )}
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
      </div>
    </WindowFrame>
  )
}
