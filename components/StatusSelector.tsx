"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { PresenceDot } from "@/components/PresenceDot"
import type { PublicProfile } from "@/lib/friends/api"
import type { PresenceState } from "@/lib/presence/state"
import { updateProfile } from "@/lib/profile/api"
import { STATUS_MAX, isValidStatus } from "@/lib/validation/profile"

type MenuAction = "available" | "busy" | "custom"
const MENU_ITEMS: readonly { label: string; action: MenuAction }[] = [
  { label: "Available", action: "available" },
  { label: "Busy", action: "busy" },
  { label: "Custom Status...", action: "custom" },
]

export const STATUS_PRESETS = [
  "Be Right Back",
  "Stepped Out",
  "Out to Lunch",
  "Not at My Desk",
  "On The Phone",
] as const

export interface StatusSelectorProps {
  me: string
  state: PresenceState
  /** Needed because saving a status rewrites the whole profile patch. */
  profile: Pick<PublicProfile, "displayName" | "statusMessage" | "nowPlaying"> | null
  onAvailable: () => void
  onBusy: () => void
  onStatusSaved: (status: string | null) => void
  /** Lets the Messenger > My Status menu item open the dropdown. */
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}

export function StatusSelector({
  me,
  state,
  profile,
  onAvailable,
  onBusy,
  onStatusSaved,
  menuOpen,
  onMenuOpenChange,
}: StatusSelectorProps) {
  const [dialog, setDialog] = useState(false)
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const statusError = `Status must be ${STATUS_MAX} characters or fewer.`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (menuOpen) listRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus()
  }, [menuOpen])

  useEffect(() => {
    if (dialog) inputRef.current?.focus()
  }, [dialog])

  function closeMenu() {
    onMenuOpenChange(false)
    triggerRef.current?.focus()
  }

  function closeDialog() {
    setDialog(false)
    setError(null)
    triggerRef.current?.focus()
  }

  function choose(action: MenuAction) {
    if (action === "available") onAvailable()
    else if (action === "busy") onBusy()
    else {
      setText(profile?.statusMessage ?? "")
      setError(null)
      setDialog(true)
      onMenuOpenChange(false)
      return
    }
    closeMenu()
  }

  function onListKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]"))
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const i = active ? items.indexOf(active) : -1
    if (e.key === "Escape") {
      e.preventDefault()
      closeMenu()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      items[(i + 1) % items.length]?.focus()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      items[(i - 1 + items.length) % items.length]?.focus()
    }
  }

  async function save() {
    if (!profile) return
    if (!isValidStatus(text)) {
      setError(statusError)
      return
    }
    setSaving(true)
    const res = await updateProfile(me, {
      display_name: profile.displayName,
      status_message: text,
      now_playing: profile.nowPlaying ?? "",
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    onStatusSaved(text.trim() === "" ? null : text)
    closeDialog()
  }

  const item = "ym-row block w-full cursor-pointer border-0 bg-transparent px-3 py-1 text-left"

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="ym-row flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Your status: ${state}. Change it.`}
        onClick={() => onMenuOpenChange(!menuOpen)}
      >
        <PresenceDot state={state} />
        <span aria-hidden="true">▾</span>
      </button>
      {menuOpen ? (
        <ul
          ref={listRef}
          role="menu"
          aria-label="Set your status"
          onKeyDown={onListKeyDown}
          className="m-0 list-none border p-0 shadow"
          style={{ position: "absolute", left: 0, top: "100%", background: "var(--window-bg)", zIndex: 50, minWidth: 170 }}
        >
          {MENU_ITEMS.map((m) => (
            <li key={m.label} role="none">
              <button role="menuitem" type="button" className={item} onClick={() => choose(m.action)}>
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {dialog ? (
        <form
          role="dialog"
          aria-label="Custom status"
          className="mt-1 border p-2"
          style={{ background: "var(--window-bg)" }}
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              closeDialog()
            }
          }}
        >
          <p className="m-0 text-xs font-bold">What&apos;s up?</p>
          <div className="my-1 flex flex-wrap gap-1">
            {STATUS_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className="ym-button"
                onClick={() => {
                  setText(p)
                  setError(null)
                  inputRef.current?.focus()
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <label className="block text-xs">
            Or write your own
            <input
              ref={inputRef}
              type="text"
              value={text}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setText(e.target.value)
                setError(isValidStatus(e.target.value) ? null : statusError)
              }}
              className="block w-full"
            />
          </label>
          <p className="m-0 text-xs">
            {text.length}/{STATUS_MAX}
          </p>
          {error ? (
            <p role="alert" className="m-0 text-xs">
              {error}
            </p>
          ) : null}
          <div className="mt-1 flex gap-1">
            <button type="submit" className="ym-button" disabled={saving || !profile || !isValidStatus(text)}>
              Save
            </button>
            <button type="button" className="ym-button" onClick={closeDialog}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
