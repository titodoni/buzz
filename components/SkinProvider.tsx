"use client";

import { createContext, useContext, type ReactNode } from "react";
import { skinTokens } from "@/lib/skin/tokens";

const SkinContext = createContext(skinTokens);

/** Exposes the skin tokens to components that need raw values (e.g. canvas, inline styles). */
export function useSkin() {
  return useContext(SkinContext);
}

/** Applies the YM skin class to a wrapper. CSS variables live in globals.css. */
export function SkinProvider({ children }: { children: ReactNode }) {
  return (
    <SkinContext.Provider value={skinTokens}>
      <div className="ym-skin">{children}</div>
    </SkinContext.Provider>
  );
}
