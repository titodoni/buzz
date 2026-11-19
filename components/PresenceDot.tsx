"use client";

import type { PresenceState } from "../lib/presence/state";
import { skinTokens } from "../lib/skin/tokens";

const LABELS: Record<PresenceState, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  offline: "Offline",
};

export function presenceLabel(state: PresenceState): string {
  return LABELS[state];
}

export interface PresenceDotProps {
  state: PresenceState;
  size?: number;
  title?: string;
}

const INK = "#3a2a00";

function Smiley({ fill, opacity = 1 }: { fill: string; opacity?: number }) {
  return (
    <g opacity={opacity}>
      <circle cx="8" cy="8" r="7" fill={fill} stroke={INK} strokeWidth="1" />
      <ellipse cx="5.6" cy="6.3" rx="1" ry="1.4" fill={INK} />
      <ellipse cx="10.4" cy="6.3" rx="1" ry="1.4" fill={INK} />
      <path
        d="M4.3 9.6 Q8 13.2 11.7 9.6"
        fill="none"
        stroke={INK}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <ellipse cx="5.6" cy="3.6" rx="3" ry="1.3" fill="#ffffff" opacity="0.35" />
    </g>
  );
}

function Glyph({ state }: { state: PresenceState }) {
  switch (state) {
    case "online":
      return <Smiley fill={skinTokens.smiley} />;
    case "offline":
      return <Smiley fill={skinTokens.offline} opacity={0.55} />;
    case "away":
      return (
        <g>
          <circle cx="8" cy="8" r="7" fill={skinTokens.smiley} stroke={INK} strokeWidth="1" />
          <circle cx="8" cy="8" r="5.2" fill="#ffffff" stroke={INK} strokeWidth="0.6" />
          <path
            d="M8 4.4 V8 L10.4 9.4"
            fill="none"
            stroke={INK}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    case "busy":
      return (
        <g>
          <circle cx="8" cy="8" r="7" fill={skinTokens.busy} stroke="#5a0f0f" strokeWidth="1" />
          <rect x="3.8" y="6.6" width="8.4" height="2.8" rx="1" fill="#ffffff" />
        </g>
      );
  }
}

export function PresenceDot({ state, size = 16, title }: PresenceDotProps) {
  const label = presenceLabel(state);
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <title>{title ?? label}</title>
      <Glyph state={state} />
    </svg>
  );
}
