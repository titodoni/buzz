"use client";

import { useId } from "react";
import type { Availability } from "../lib/presence/state";

const LABELS: Record<Availability, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  offline: "Offline",
  invisible: "Invisible: friends see you as offline",
};

export function presenceLabel(state: Availability): string {
  return LABELS[state];
}

export interface PresenceDotProps {
  /** Friends only ever have the first four; Invisible is the user's own choice. */
  state: Availability;
  size?: number;
  /** Hide from screen readers when a text label sits right next to the icon. */
  decorative?: boolean;
  title?: string;
}

const INK = "#3a2a00";

function Smiley({ gradId, outline = "#7a5300", sleepy = false, opacity = 1 }: { gradId: string; outline?: string; sleepy?: boolean; opacity?: number }) {
  return (
    <g opacity={opacity}>
      <circle cx="8" cy="8" r="7" fill={`url(#${gradId})`} stroke={outline} strokeWidth="0.9" />
      <ellipse cx="6.2" cy="3.9" rx="3.4" ry="1.5" fill="#ffffff" opacity="0.45" />
      {sleepy ? (
        <>
          <path d="M4.6 6.8 H6.6 M9.4 6.8 H11.4" stroke="#4c5059" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M5.4 10.4 H10.6" stroke="#4c5059" strokeWidth="1.15" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="5.7" cy="6.4" rx="0.95" ry="1.35" fill={INK} />
          <ellipse cx="10.3" cy="6.4" rx="0.95" ry="1.35" fill={INK} />
          <path
            d="M4.3 9.4 Q8 13 11.7 9.4"
            fill="none"
            stroke={INK}
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
}

function Glyph({ state, uid }: { state: Availability; uid: string }) {
  const gold = `${uid}-g`;
  const silver = `${uid}-s`;
  const red = `${uid}-r`;
  switch (state) {
    case "online":
      return (
        <>
          <defs>
            <radialGradient id={gold} cx="35%" cy="30%" r="70%">
              <stop offset="0" stopColor="#fff7b2" />
              <stop offset="0.45" stopColor="#ffd018" />
              <stop offset="1" stopColor="#d88d00" />
            </radialGradient>
          </defs>
          <Smiley gradId={gold} />
        </>
      );
    case "offline":
      return (
        <>
          <defs>
            <radialGradient id={silver} cx="35%" cy="30%" r="70%">
              <stop offset="0" stopColor="#f7f8fa" />
              <stop offset="0.55" stopColor="#cdd1d9" />
              <stop offset="1" stopColor="#9499a3" />
            </radialGradient>
          </defs>
          <Smiley gradId={silver} outline="#6e737d" sleepy />
        </>
      );
    case "invisible":
      return (
        <>
          <defs>
            <radialGradient id={gold} cx="35%" cy="30%" r="70%">
              <stop offset="0" stopColor="#fff7b2" />
              <stop offset="0.45" stopColor="#ffd018" />
              <stop offset="1" stopColor="#d88d00" />
            </radialGradient>
          </defs>
          <g>
            <Smiley gradId={gold} opacity={0.55} />
            <circle cx="8" cy="8" r="7.4" fill="none" stroke={INK} strokeWidth="0.95" strokeDasharray="2 1.6" />
          </g>
        </>
      );
    case "away":
      return (
        <>
          <defs>
            <radialGradient id={gold} cx="35%" cy="30%" r="70%">
              <stop offset="0" stopColor="#fff7b2" />
              <stop offset="0.45" stopColor="#ffd018" />
              <stop offset="1" stopColor="#d88d00" />
            </radialGradient>
          </defs>
          <g>
            <circle cx="8" cy="8" r="7" fill={`url(#${gold})`} stroke="#7a5300" strokeWidth="0.9" />
            <circle cx="8" cy="8" r="4.9" fill="#ffffff" stroke="#7a5300" strokeWidth="0.7" />
            <path
              d="M8 4.6 V8 L10.3 9.3"
              fill="none"
              stroke={INK}
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </>
      );
    case "busy":
      return (
        <>
          <defs>
            <radialGradient id={red} cx="35%" cy="28%" r="70%">
              <stop offset="0" stopColor="#ff8b78" />
              <stop offset="0.45" stopColor="#dd2818" />
              <stop offset="1" stopColor="#8d0d05" />
            </radialGradient>
          </defs>
          <g>
            <circle cx="8" cy="8" r="7" fill={`url(#${red})`} stroke="#650903" strokeWidth="0.9" />
            <ellipse cx="6.2" cy="3.8" rx="3.2" ry="1.3" fill="#ffffff" opacity="0.35" />
            <rect x="3.8" y="6.6" width="8.4" height="2.8" rx="1" fill="#ffffff" />
          </g>
        </>
      );
  }
}

export function PresenceDot({ state, size = 16, title, decorative = false }: PresenceDotProps) {
  const label = presenceLabel(state);
  const uid = `pd-${useId().replace(/:/g, "")}`;
  return (
    <svg
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      {decorative ? null : <title>{title ?? label}</title>}
      <Glyph state={state} uid={uid} />
    </svg>
  );
}
