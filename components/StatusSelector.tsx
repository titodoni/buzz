"use client"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { PresenceDot } from "@/components/PresenceDot"
import type { PublicProfile } from "@/lib/friends/api"
import type { Availability } from "@/lib/presence/state"
import { updateProfile } from "@/lib/profile/api"
import {
  PRESET_STATUSES,
  applyPreset,
  chooseAvailable,
  customStatus,
  type PresetStatus,
  type StatusAvailability,
  type StatusChoice,
} from "@/lib/status/presets"
import { STATUS_MAX, isValidStatus } from "@/lib/validation/profile"

type MenuAction =
  | { kind: "available" }
  | { kind: "busy" }
  | { kind: "invisible" }
  | { kind: "preset"; name: PresetStatus }
  | { kind: "custom" }

interface MenuEntry {
  label: string
  action: MenuAction
  /** Which Availability this entry leads to, so its row can show the matching icon. */
  icon: Availability
}

const MAIN_ENTRIES: readonly MenuEntry[] = [
  { label: "Available", action: { kind: "available" }, icon: "online" },
  { label: "Busy", action: { kind: "busy" }, icon: "busy" },
  { label: "Invisible", action: { kind: "invisible" }, icon: "invisible" },
]
const PRESET_ENTRIES: readonly MenuEntry[] = PRESET_STATUSES.map((name) => ({
  label: name,
  action: { kind: "preset", name },
  icon: "busy",
}))
const CUSTOM_ENTRY: MenuEntry = { label: "Custom Status...", action: { kind: "custom" }, icon: "online" }

export interface StatusSelectorProps {
  me: string
  state: Availability
  /** Needed because saving a status rewrites the whole profile patch. */
  profile: Pick<PublicProfile, "displayName" | "statusMessage" | "nowPlaying"> | null
  onAvailable: () => void
  onBusy: () => void
  onInvisible: () => void
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
  onInvisible,
  onStatusSaved,
  menuOpen,
  onMenuOpenChange,
}: StatusSelectorProps) {
  const [dialog, setDialog] = useState(false)
  const [text, setText] = useState("")
  const [availability, setAvailability] = useState<StatusAvailability>("online")
  const [error, setError] = useState<string | null>(null)
  const [menuError, setMenuError] = useState<string | null>(null)
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
  function applyAvailability(a: StatusAvailability) {
    if (a === "busy") onBusy()
    else onAvailable()
  }

  /** Saves the status text; the Availability is changed by the caller. */
  async function saveText(choice: StatusChoice): Promise<string | null> {
    if (!profile) return "Still loading your profile. Try again in a moment."
    const res = await updateProfile(me, {
      display_name: profile.displayName,
      status_message: choice.text ?? "",
      now_playing: profile.nowPlaying ?? "",
    })
    if (!res.ok) return res.message
    onStatusSaved(choice.text)
    return null
  }

  async function choose(action: MenuAction) {
    setMenuError(null)
    if (action.kind === "custom") {
      setText(profile?.statusMessage ?? "")
      setAvailability(state === "busy" ? "busy" : "online")
      setError(null)
      setDialog(true)
      onMenuOpenChange(false)
      return
    }
    closeMenu()
    // The icon changes at once; the text is saved after (Req 12.2).
    if (action.kind === "busy") {
      onBusy()
    } else if (action.kind === "invisible") {
      onInvisible()
    } else if (action.kind === "available") {
      onAvailable()
      const choice = chooseAvailable(profile?.statusMessage)
      if (choice.text !== (profile?.statusMessage ?? null)) setMenuError(await saveText(choice))
    } else {
      onBusy()
      setMenuError(await saveText(applyPreset(action.name)))
    }
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

  async function saveCustom() {
    if (!isValidStatus(text)) {
      setError(statusError)
      return
    }
    setSaving(true)
    const choice = customStatus(text, availability)
    applyAvailability(choice.availability)
    const problem = await saveText(choice)
    setSaving(false)
    if (problem) {
      setError(problem)
      return
    }
    closeDialog()
  }

  const itemClass = "ym-row flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-1 text-left"
  const renderGroup = (entries: readonly MenuEntry[]) =>
    entries.map((m) => (
      <li key={m.label} role="none">
        <button role="menuitem" type="button" className={itemClass} onClick={() => void choose(m.action)}>
          <PresenceDot state={m.icon} size={14} decorative />
          {m.label}
        </button>
      </li>
    ))

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
      {menuError ? (
        <p role="alert" className="m-0 text-xs" style={{ color: "var(--buzz-red)" }}>
          {menuError}
        </p>
      ) : null}
      {menuOpen ? (
        <ul
          ref={listRef}
          role="menu"
          aria-label="Set your status"
          onKeyDown={onListKeyDown}
          className="ym-dropdown m-0 list-none border p-0 shadow"
          style={{
            position: "absolute",
            left: 0,
            top: "100%",
            background: "var(--window-bg)",
            zIndex: 50,
            minWidth: 180,
            maxHeight: "calc(100vh - 90px)",
            overflowY: "auto",
          }}
        >
          {renderGroup(MAIN_ENTRIES)}
          <li role="separator" className="my-1 border-t" />
          {renderGroup(PRESET_ENTRIES)}
          <li role="separator" className="my-1 border-t" />
          {renderGroup([CUSTOM_ENTRY])}
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
            void saveCustom()
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              closeDialog()
            }
          }}
        >
          <label className="block text-xs font-bold">
            What&apos;s up?
            <input
              ref={inputRef}
              type="text"
              value={text}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setText(e.target.value)
                setError(isValidStatus(e.target.value) ? null : statusError)
              }}
              className="mt-1 block w-full font-normal"
            />
          </label>
          <p className="m-0 text-xs">
            {text.length}/{STATUS_MAX}
          </p>
          <fieldset className="m-0 mt-1 border-0 p-0 text-xs">
            <legend className="font-bold">While this is showing, I am</legend>
            <label className="mr-2 inline-flex items-center gap-1">
              <input
                type="radio"
                name="custom-availability"
                checked={availability === "online"}
                onChange={() => setAvailability("online")}
              />
              Available
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="custom-availability"
                checked={availability === "busy"}
                onChange={() => setAvailability("busy")}
              />
              Busy
            </label>
          </fieldset>
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
