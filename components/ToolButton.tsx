"use client"

import type { ReactNode } from "react"

export interface ToolButtonProps {
  label: string
  icon: ReactNode
  onClick: () => void
  pressed?: boolean
  expanded?: boolean
  disabled?: boolean
  title?: string
}

/** A classic messenger toolbar button: an icon with a short word under it. */
export function ToolButton({ label, icon, onClick, pressed, expanded, disabled, title }: ToolButtonProps) {
  return (
    <button
      type="button"
      className="ym-tool"
      aria-pressed={pressed}
      aria-expanded={expanded}
      disabled={disabled}
      title={title ?? label}
      onClick={onClick}
    >
      <span aria-hidden="true" className="ym-tool-icon">
        {icon}
      </span>
      <span className="ym-tool-label">{label}</span>
    </button>
  )
}

const svg = { width: 22, height: 22, viewBox: "0 0 24 24", "aria-hidden": true } as const

export const AddFriendIcon = (
  <svg {...svg}>
    <circle cx="9" cy="8" r="4" fill="#ffcc00" stroke="#3a2a00" strokeWidth="1.5" />
    <path d="M2 21c0-4 3-7 7-7s7 3 7 7z" fill="#ffcc00" stroke="#3a2a00" strokeWidth="1.5" />
    <circle cx="18.5" cy="15.5" r="4.5" fill="#2e9e2e" stroke="#145214" strokeWidth="1" />
    <path d="M18.5 13v5M16 15.5h5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

export const SendImIcon = (
  <svg {...svg}>
    <path d="M3 4h18v12H10l-5 4v-4H3z" fill="#ffffff" stroke="#0067fa" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M7 8.5h10M7 11.5h7" stroke="#0067fa" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

export const UpForChatIcon = (
  <svg {...svg}>
    <g stroke="#e8820a" strokeWidth="1.6" strokeLinecap="round">
      <path d="M12 1.5v2.5M12 20v2.5M1.5 12h2.5M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
    </g>
    <circle cx="12" cy="12" r="6.5" fill="#ffcc00" stroke="#3a2a00" strokeWidth="1.3" />
    <circle cx="9.8" cy="10.6" r=".9" fill="#3a2a00" />
    <circle cx="14.2" cy="10.6" r=".9" fill="#3a2a00" />
    <path d="M9 13.5c1.6 2 4.4 2 6 0" fill="none" stroke="#3a2a00" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
)

export const RecentBuzzesIcon = (
  <svg {...svg}>
    <path d="M12 3a6 6 0 0 1 6 6v4l2 3H4l2-3V9a6 6 0 0 1 6-6z" fill="#ffcc00" stroke="#3a2a00" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M9.5 19a2.5 2.5 0 0 0 5 0" fill="none" stroke="#3a2a00" strokeWidth="1.5" />
    <path d="M2 6l2 1M22 6l-2 1M2.5 11h2M21.5 11h-2" stroke="#cc0000" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)
