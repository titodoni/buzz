"use client";

import { useEffect, useRef } from "react";
import { PICKER_EMOTICONS } from "@/lib/emoticons/shortcode";

export interface EmoticonPickerProps {
  onPick: (shortcode: string) => void;
  /** Close the picker; the caller returns focus to the message box. */
  onClose: () => void;
}

export function EmoticonPicker({ onPick, onClose }: EmoticonPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Emoticons"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        zIndex: 10,
        display: "grid",
        gridTemplateColumns: "repeat(7, 32px)",
        gap: 2,
        padding: 6,
        background: "#fff",
        border: "1px solid var(--ym-purple-deep)",
        borderRadius: 4,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      {PICKER_EMOTICONS.map((e) => (
        <button
          key={e.shortcode}
          type="button"
          title={e.name}
          aria-label={`${e.name} ${e.shortcode}`}
          onClick={() => onPick(e.shortcode)}
          style={{ width: 32, height: 32, padding: 2, background: "transparent", border: "none", cursor: "pointer" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, tiny local SVGs */}
          <img src={e.path} alt="" width={24} height={24} />
        </button>
      ))}
    </div>
  );
}

export default EmoticonPicker;
