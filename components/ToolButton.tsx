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
    <defs>
      <radialGradient id="buzz-tb-add-g" cx="35%" cy="30%" r="70%">
        <stop offset="0" stopColor="#fff8b8" />
        <stop offset="0.5" stopColor="#ffd01a" />
        <stop offset="1" stopColor="#d88c00" />
      </radialGradient>
      <linearGradient id="buzz-tb-add-plus" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6be052" />
        <stop offset="1" stopColor="#1e7e18" />
      </linearGradient>
    </defs>
    <circle cx="13" cy="12" r="8.5" fill="url(#buzz-tb-add-g)" stroke="#7a5200" strokeWidth="1.2" />
    <ellipse cx="10.8" cy="6.8" rx="4" ry="1.6" fill="#ffffff" opacity="0.5" />
    <ellipse cx="10.4" cy="10.3" rx="1" ry="1.5" fill="#3a2a00" />
    <ellipse cx="15.6" cy="10.3" rx="1" ry="1.5" fill="#3a2a00" />
    <path d="M9.2 13.8 Q13 17.6 16.8 13.8" fill="none" stroke="#3a2a00" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M5 1.5V8.5M1.5 5H8.5" stroke="#145214" strokeWidth="4.2" strokeLinecap="round" />
    <path d="M5 1.5V8.5M1.5 5H8.5" stroke="url(#buzz-tb-add-plus)" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
)

export const SendImIcon = (
  <svg {...svg}>
    <defs>
      <linearGradient id="buzz-tb-im-b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#69b8ff" />
        <stop offset="0.5" stopColor="#1f79eb" />
        <stop offset="1" stopColor="#0948a8" />
      </linearGradient>
    </defs>
    <path
      d="M3 5C3 3.9 3.9 3 5 3H19C20.1 3 21 3.9 21 5V14.5C21 15.6 20.1 16.5 19 16.5H10L5.2 21V16.5H5C3.9 16.5 3 15.6 3 14.5Z"
      fill="url(#buzz-tb-im-b)"
      stroke="#08387e"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M4.5 5.2C4.5 4.5 5 4.2 5.8 4.2H18.2C19 4.2 19.5 4.6 19.5 5.2V8.2H4.5Z" fill="#ffffff" opacity="0.24" />
    <path d="M12 6.2V11.2" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="12" cy="13.8" r="1.3" fill="#ffffff" />
  </svg>
)

export const UpForChatIcon = (
  <svg {...svg}>
    <defs>
      <radialGradient id="buzz-tb-up-g" cx="35%" cy="30%" r="70%">
        <stop offset="0" stopColor="#fff8b8" />
        <stop offset="0.5" stopColor="#ffd01a" />
        <stop offset="1" stopColor="#d88c00" />
      </radialGradient>
    </defs>
    <g stroke="#e07a00" strokeWidth="1.7" strokeLinecap="round">
      <path d="M12 1.2v2.4M12 20.4v2.4M1.2 12h2.4M20.4 12h2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" />
    </g>
    <circle cx="12" cy="12" r="6.6" fill="url(#buzz-tb-up-g)" stroke="#7a5200" strokeWidth="1.2" />
    <ellipse cx="10.4" cy="8" rx="3" ry="1.2" fill="#ffffff" opacity="0.45" />
    <circle cx="9.8" cy="10.8" r=".95" fill="#3a2a00" />
    <circle cx="14.2" cy="10.8" r=".95" fill="#3a2a00" />
    <path d="M9 13.4c1.6 2 4.4 2 6 0" fill="none" stroke="#3a2a00" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)

export const RecentBuzzesIcon = (
  <svg {...svg}>
    <defs>
      <linearGradient id="buzz-tb-bell-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff39a" />
        <stop offset="0.5" stopColor="#ffca18" />
        <stop offset="1" stopColor="#c77d00" />
      </linearGradient>
    </defs>
    <path d="M2.2 6l2.1 1M21.8 6l-2.1 1M2.5 11h2M19.5 11h2" stroke="#cc1818" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M12 3a5.8 5.8 0 0 1 5.8 5.8V13l1.9 3H4.3l1.9-3V8.8A5.8 5.8 0 0 1 12 3Z" fill="url(#buzz-tb-bell-g)" stroke="#6e4800" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M10.2 5C8.5 5.4 7.7 7 7.6 9.6" fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
    <path d="M9.6 18.8a2.5 2.5 0 0 0 4.8 0" fill="none" stroke="#6e4800" strokeWidth="1.5" />
  </svg>
)
