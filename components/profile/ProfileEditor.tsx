"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { WindowFrame } from "@/components/WindowFrame"
import { useSession } from "@/lib/auth/session"
import { takeProfileNotice } from "@/lib/profile/notice"
import { getMyProfile, updateProfile } from "@/lib/profile/api"
import { planProfileSave, type ProfileField, type ProfileFields } from "@/lib/profile/save"
import { DISPLAY_NAME_MAX, NOW_PLAYING_MAX, STATUS_MAX } from "@/lib/validation/profile"

import { AvatarUpload } from "./AvatarUpload"

interface FieldProps {
  id: string
  label: string
  value: string
  max: number
  error?: string
  onChange: (v: string) => void
}

function Field({ id, label, value, max, error, onChange }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        // No maxLength: over-limit input must show the limit error instead of silently truncating.
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <div className="flex justify-between text-xs">
        <span id={`${id}-error`} role={error ? "alert" : undefined} style={{ color: "#b00020" }}>
          {error ?? ""}
        </span>
        <span>
          {value.length}/{max}
        </span>
      </div>
    </div>
  )
}

export function ProfileEditor() {
  const router = useRouter()
  const { user } = useSession()
  const userId = user?.id ?? null

  const [saved, setSaved] = useState<ProfileFields | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [status, setStatus] = useState("")
  const [nowPlaying, setNowPlaying] = useState("")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const pending = takeProfileNotice()
    // Read once after mount: sessionStorage doesn't exist during the static prerender.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pending) setNotice(pending)
  }, [])

  useEffect(() => {
    if (!userId) return
    let active = true
    void getMyProfile(userId).then((res) => {
      if (!active) return
      if (!res.ok) {
        setLoadError(res.message)
        return
      }
      const p = res.profile
      setSaved({
        display_name: p.display_name,
        status_message: p.status_message,
        now_playing: p.now_playing,
      })
      setAvatarUrl(p.avatar_url)
      setName(p.display_name)
      setStatus(p.status_message ?? "")
      setNowPlaying(p.now_playing ?? "")
    })
    return () => {
      active = false
    }
  }, [userId])

  async function onSave() {
    if (!userId || !saved || saving) return
    setNotice(null)
    setFormError(null)
    const draft = { display_name: name, status_message: status, now_playing: nowPlaying }
    const plan = planProfileSave(saved, draft)
    if (!plan.ok) {
      setErrors({ [plan.field]: plan.message })
      // Keep the previous value of the rejected field (Req 2.2, 7.3).
      if (plan.field === "display_name") setName(plan.keep.display_name)
      return
    }
    setErrors({})
    setSaving(true)
    const res = await updateProfile(userId, draft, saved)
    setSaving(false)
    if (!res.ok) {
      setFormError(res.message)
      return
    }
    setSaved(plan.patch)
    setStatus(plan.patch.status_message ?? "")
    setNowPlaying(plan.patch.now_playing ?? "")
    setName(plan.patch.display_name)
    setNotice("Saved!")
  }

  return (
    <WindowFrame title="My Profile">
      <div className="flex flex-col gap-3 p-3 text-sm">
        {loadError ? (
          <p role="alert" style={{ color: "#b00020" }}>
            {loadError}
          </p>
        ) : !saved || !userId ? (
          <p role="status">Loading...</p>
        ) : (
          <>
            <AvatarUpload userId={userId} currentUrl={avatarUrl} onUploaded={setAvatarUrl} />
            <Field
              id="display-name"
              label="Display name"
              value={name}
              max={DISPLAY_NAME_MAX}
              error={errors.display_name}
              onChange={setName}
            />
            <Field
              id="status"
              label="Status"
              value={status}
              max={STATUS_MAX}
              error={errors.status_message}
              onChange={setStatus}
            />
            <Field
              id="now-playing"
              label="♪ Now playing"
              value={nowPlaying}
              max={NOW_PLAYING_MAX}
              error={errors.now_playing}
              onChange={setNowPlaying}
            />
            {formError ? (
              <p role="alert" style={{ color: "#b00020" }}>
                {formError}
              </p>
            ) : null}
            {notice ? <p role="status">{notice}</p> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => void onSave()} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => router.push("/")}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </WindowFrame>
  )
}

export default ProfileEditor
