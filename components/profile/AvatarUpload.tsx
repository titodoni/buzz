"use client"

import { useEffect, useRef, useState, type DragEvent } from "react"

import { uploadAvatar } from "@/lib/profile/api"
import { AVATAR_TYPES, checkAvatar } from "@/lib/validation/profile"

export interface AvatarUploadProps {
  userId: string
  /** Currently saved avatar URL (kept when a new file is rejected). */
  currentUrl: string | null
  onUploaded?: (url: string) => void
}

export function AvatarUpload({ userId, currentUrl, onUploaded }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Revoke the object URL when it is replaced or the component unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function handleFile(file: File | undefined) {
    if (!file || busy) return
    const check = checkAvatar(file)
    if (!check.ok) {
      setError(check.reason ?? "That picture can't be used.")
      return
    }
    setError(null)
    setBusy(true)
    setPreview(URL.createObjectURL(file))
    const res = await uploadAvatar(userId, file)
    setBusy(false)
    if (res.ok) {
      onUploaded?.(res.url)
    } else {
      setPreview(null)
      setError(res.message)
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    void handleFile(e.dataTransfer.files[0])
  }

  const shown = preview ?? currentUrl

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          width: 96,
          height: 96,
          border: dragging ? "2px dashed #7b3fa0" : "2px solid #ccc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- static export, user-supplied URL
          <img src={shown} alt="Your picture" width={96} height={96} style={{ objectFit: "cover" }} />
        ) : (
          <span className="text-xs">No picture</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_TYPES.join(",")}
        hidden
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Uploading..." : "Change picture"}
      </button>
      <span className="text-xs">Drop an image here. PNG, JPEG or WebP, up to 2 MB.</span>
      {error ? (
        <p role="alert" className="text-xs" style={{ color: "#b00020" }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
