"use client";

import type { MouseEvent, ReactNode } from "react";
import { BuzzLogo } from "./BuzzLogo";
import {
  closeWindow,
  minimizeWindow,
  startDraggingWindow,
  toggleMaximizeWindow,
} from "../lib/tauri/windows";

export interface TitleBarProps {
  title: string;
  icon?: ReactNode;
  showMaximize?: boolean;
}

const controlStyle = {
  width: 21,
  height: 19,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#ffffff",
  cursor: "pointer",
  border: "1px solid rgb(255 255 255 / 0.65)",
  borderRadius: 3,
  boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.35), 0 1px 1px rgb(0 0 0 / 0.25)",
  background: "linear-gradient(to bottom, rgb(255 255 255 / 0.28), rgb(255 255 255 / 0.06))",
} as const;

const closeControlStyle = {
  ...controlStyle,
  border: "1px solid rgb(255 215 215 / 0.75)",
  background: "linear-gradient(to bottom, #e55b4b, #b62519)",
} as const;

function stop(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

export function TitleBar({ title, icon, showMaximize = true }: TitleBarProps) {
  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    void startDraggingWindow();
  };
  return (
    <div
      className="ym-titlebar"
      onMouseDown={onMouseDown}
      onDoubleClick={() => {
        if (showMaximize) void toggleMaximizeWindow();
      }}
      style={{ gap: 6, userSelect: "none", fontSize: 12, flexShrink: 0 }}
    >
      {icon ? <span style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span> : <BuzzLogo size={16} />}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 12,
          fontWeight: "bold",
          color: "#ffffff",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </span>
      <div
        style={{ display: "flex", gap: 3, flexShrink: 0 }}
        onMouseDown={stop}
        onDoubleClick={stop}
      >
        <button
          type="button"
          aria-label="Minimize"
          style={controlStyle}
          onClick={() => void minimizeWindow()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="1" y="7" width="8" height="2" fill="currentColor" />
          </svg>
        </button>
        {showMaximize ? (
          <button
            type="button"
            aria-label="Maximize"
            style={controlStyle}
            onClick={() => void toggleMaximizeWindow()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Close"
          style={closeControlStyle}
          onClick={() => void closeWindow()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
