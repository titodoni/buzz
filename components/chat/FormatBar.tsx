"use client";

import { FONTS, MAX_SIZE, MIN_SIZE, parseFormat, type MessageFormat } from "@/lib/chat/format";

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i);

/** One B, I, or U toggle. */
function StyleToggle(props: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  children: string;
  style: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className="ym-format-toggle"
      aria-label={props.label}
      aria-pressed={props.pressed}
      title={props.label}
      onClick={props.onToggle}
      style={props.style}
    >
      {props.children}
    </button>
  );
}

/**
 * The formatting bar above the message box (Req 17.2): font, size, color,
 * bold, italic, underline. Every change goes through parseFormat, so only an
 * allowed format is ever kept.
 */
export function FormatBar({ format, onChange }: { format: MessageFormat; onChange: (f: MessageFormat) => void }) {
  const set = (change: Partial<MessageFormat>) => onChange(parseFormat({ ...format, ...change }));
  return (
    <div role="toolbar" aria-label="Text formatting" className="ym-format-bar">
      <select
        aria-label="Font"
        value={format.font}
        onChange={(e) => set({ font: e.target.value as MessageFormat["font"] /* checked by parseFormat */ })}
      >
        {FONTS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <select aria-label="Size" value={format.size} onChange={(e) => set({ size: Number(e.target.value) })}>
        {SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <StyleToggle label="Bold" pressed={format.bold} onToggle={() => set({ bold: !format.bold })} style={{ fontWeight: 700 }}>
        B
      </StyleToggle>
      <StyleToggle
        label="Italic"
        pressed={format.italic}
        onToggle={() => set({ italic: !format.italic })}
        style={{ fontStyle: "italic" }}
      >
        I
      </StyleToggle>
      <StyleToggle
        label="Underline"
        pressed={format.underline}
        onToggle={() => set({ underline: !format.underline })}
        style={{ textDecoration: "underline" }}
      >
        U
      </StyleToggle>
      <label className="ym-format-color" title="Text color">
        <span className="sr-only">Text color</span>
        <input type="color" value={format.color} onChange={(e) => set({ color: e.target.value.toLowerCase() })} />
      </label>
    </div>
  );
}
