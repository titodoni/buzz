"use client";

import type { ReactNode } from "react";
import { TitleBar } from "./TitleBar";

export interface WindowFrameProps {
  title: string;
  children: ReactNode;
  menuBar?: ReactNode;
  /** Shown at the left of the title bar, e.g. the user's own Status_Icon. */
  icon?: ReactNode;
  className?: string;
}

export function WindowFrame({ title, children, menuBar, icon, className }: WindowFrameProps) {
  return (
    <div
      className={`ym-window${className ? ` ${className}` : ""}`}
      style={{ width: "100vw", height: "100vh", boxSizing: "border-box" }}
    >
      <TitleBar title={title} icon={icon} />
      {menuBar ? <div style={{ flexShrink: 0 }}>{menuBar}</div> : null}
      <div className="ym-window-body">
        <div className="ym-content">{children}</div>
      </div>
    </div>
  );
}
