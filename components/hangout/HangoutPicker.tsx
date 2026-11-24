"use client"

import { useState } from "react"
import { HANGOUT_TEMPLATES, HANGOUT_TEXT_MAX, validateHangoutText } from "@/lib/hangout/templates"

/**
 * Picks the line for a Hangout: one tap on a template, or a custom line of
 * up to 60 characters (buzz-trigger R3.1).
 */
export function HangoutPicker({ onSend, onClose }: { onSend: (text: string) => void; onClose: () => void }) {
  const [custom, setCustom] = useState("")
  const checked = validateHangoutText(custom)

  return (
    <div role="dialog" aria-label="Start a Hangout" className="border px-2 py-2" style={{ background: "var(--window-bg, #fff)" }}>
      <p className="m-0 text-xs font-bold">Start a Hangout</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {HANGOUT_TEMPLATES.map((t) => (
          <button key={t} type="button" className="ym-button" onClick={() => onSend(t)}>
            {t}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          if (checked.ok) onSend(checked.text)
        }}
      >
        <label className="text-xs" htmlFor="hangout-custom">
          Your own
        </label>
        <input
          id="hangout-custom"
          className="min-w-0 flex-1 border px-1"
          value={custom}
          maxLength={HANGOUT_TEXT_MAX}
          onChange={(e) => setCustom(e.target.value)}
        />
        <span className="text-xs" aria-live="polite">
          {custom.length}/{HANGOUT_TEXT_MAX}
        </span>
        <button type="submit" className="ym-button" disabled={!checked.ok}>
          Send
        </button>
      </form>
      <button type="button" className="ym-button mt-1" onClick={onClose}>
        Cancel
      </button>
    </div>
  )
}
