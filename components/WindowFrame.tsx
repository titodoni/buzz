"use client";

import type { ReactNode } from "react";
import { TitleBar } from "./TitleBar";

export interface WindowFrameProps {
  title: string;
  children: ReactNode;
  menuBar?: ReactNode;
  className?: string;
}

export function WindowFrame({ title, children, menuBar, className }: WindowFrameProps) {
  return (
    <div
      className={`ym-window${className ? ` ${className}` : ""}`}
      style={{ width: "100vw", height: "100vh", boxSizing: "border-box" }}
    >
      <TitleBar title={title} />
      {menuBar ? <div style={{ flexShrink: 0 }}>{menuBar}</div> : null}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</div>
    </div>
  );
}
