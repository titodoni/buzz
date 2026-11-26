"use client";
import type { ReactNode, Ref } from "react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** A person's picture with their name underneath, for the chat's pictures column. */
export function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 8 }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatar in a static export
        <img
          src={url}
          alt={`${name}'s picture`}
          width={64}
          height={64}
          style={{
            objectFit: "cover",
            background: "#ffffff",
            padding: 2,
            border: "1px solid #b8b2c9",
            boxShadow: "0 1px 2px rgb(0 0 0 / 0.12)",
          }}
        />
      ) : (
        <div
          role="img"
          aria-label={`${name}'s picture`}
          style={{
            width: 64,
            height: 64,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(to bottom, #823ee0, #460e8c)",
            color: "var(--titlebar-text)",
            border: "2px solid #ffffff",
            outline: "1px solid #b8b2c9",
            boxShadow: "0 1px 2px rgb(0 0 0 / 0.12)",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {initials(name)}
        </div>
      )}
      <div style={{ fontSize: 11, overflowWrap: "anywhere" }}>{name}</div>
    </div>
  );
}

export interface ChatLayoutProps {
  /** The element a Nudge shakes. */
  rootRef?: Ref<HTMLDivElement>;
  /** The menu bar under the title bar (Req 17.1). */
  menu?: ReactNode;
  header: ReactNode;
  /** Optional line under the header, e.g. a load error. */
  notice?: ReactNode;
  list: ReactNode;
  typing: ReactNode;
  toolbar: ReactNode;
  input: ReactNode;
  pictures: ReactNode;
}

/**
 * The chat window's arrangement and nothing else, so it can be shown without
 * a network connection. How it adapts to the window size lives in
 * app/globals.css (`.ym-chat*`): the pictures column hides under 400 px, the
 * toolbar wraps, and short windows tighten up (Requirement 11).
 */
export function ChatLayout({ rootRef, menu, header, notice, list, typing, toolbar, input, pictures }: ChatLayoutProps) {
  return (
    <div ref={rootRef} className="ym-chat">
      {menu}
      <header className="ym-chat-header">{header}</header>
      {notice}
      <div className="ym-chat-body">
        <div className="ym-chat-main">
          <div className="ym-chat-list">{list}</div>
          {typing}
          <div className="ym-chat-toolbar">{toolbar}</div>
          {input}
        </div>
        <aside className="ym-chat-pictures" aria-label="Pictures">
          {pictures}
        </aside>
      </div>
    </div>
  );
}
