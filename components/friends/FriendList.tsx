"use client"

import { useEffect, useRef, useState } from "react"
import { removeFriend, type FriendEntry } from "@/lib/friends/api"
import type { PresenceState } from "@/lib/presence/state"
import { hasNowPlaying, shouldShowField } from "@/lib/profile/render"
import { openChatWindow } from "@/lib/tauri/windows"
import { FriendListItem } from "./FriendListItem"

/** Non-offline first, then alphabetical by display name. */
export function sortFriends(
  friends: FriendEntry[],
  presence: Record<string, PresenceState>,
): FriendEntry[] {
  const offline = (f: FriendEntry) => ((presence[f.id] ?? "offline") === "offline" ? 1 : 0)
  return [...friends].sort((a, b) => {
    if (offline(a) !== offline(b)) return offline(a) - offline(b)
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
  })
}

type Overlay =
  | { kind: "menu"; friend: FriendEntry; x: number; y: number }
  | { kind: "profile"; friend: FriendEntry }
  | { kind: "confirm"; friend: FriendEntry }
  | null

const MENU_ITEM = "ym-row block w-full cursor-pointer border-0 bg-transparent px-3 py-1 text-left"

export function FriendList({
  friends,
  presence = {},
  unreadBySender = {},
  onChanged,
}: {
  friends: FriendEntry[]
  /** Friend id to state. Missing ids are treated as offline. */
  presence?: Record<string, PresenceState>
  /** Waiting messages per sender id, shown as "(n)" after the name. */
  unreadBySender?: Record<string, number>
  onChanged: () => void
}) {
  const [open, setOpen] = useState(true)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [note, setNote] = useState<string | null>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  const sorted = sortFriends(friends, presence)
  const onlineCount = sorted.filter((f) => (presence[f.id] ?? "offline") !== "offline").length

  const menuOpen = overlay?.kind === "menu"
  useEffect(() => {
    if (!menuOpen) return
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus()
    const onMouse = (e: MouseEvent) => {
      // event targets are typed EventTarget; a mousedown target is always a Node
      if (!menuRef.current?.contains(e.target as Node)) setOverlay(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverlay(null)
    }
    document.addEventListener("mousedown", onMouse)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onMouse)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  async function doRemove(f: FriendEntry) {
    const res = await removeFriend(f.friendshipId)
    setNote(res.message ?? null)
    setOverlay(null)
    if (res.ok) onChanged()
  }

  return (
    <section aria-label="Friends">
      <h2 className="m-0 text-sm">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="ym-row w-full cursor-pointer border-0 bg-transparent px-2 py-1 text-left font-bold"
        >
          <span aria-hidden="true">{open ? "▼" : "▶"} </span>
          Friends ({onlineCount}/{friends.length})
        </button>
      </h2>
      {open ? (
        friends.length === 0 ? (
          <p className="px-2 text-xs">No friends yet. Use “Add a Contact” to find someone!</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {sorted.map((f) => (
              <FriendListItem
                key={f.id}
                friend={f}
                presence={presence[f.id] ?? "offline"}
                unread={unreadBySender[f.id]}
                onOpen={(id) => void openChatWindow(id)}
                onContextMenu={(friend, x, y) => setOverlay({ kind: "menu", friend, x, y })}
              />
            ))}
          </ul>
        )
      ) : null}
      <p role="status" className="min-h-4 px-2 text-xs">
        {note}
      </p>

      {overlay?.kind === "menu" ? (
        <ul
          ref={menuRef}
          role="menu"
          aria-label={`Options for ${overlay.friend.displayName}`}
          className="m-0 list-none border p-0 shadow"
          style={{
            position: "fixed",
            left: Math.max(0, Math.min(overlay.x, window.innerWidth - 180)),
            top: Math.max(0, Math.min(overlay.y, window.innerHeight - 110)),
            background: "var(--window-bg)",
            zIndex: 50,
            minWidth: 170,
          }}
        >
          <li role="none">
            <button
              role="menuitem"
              type="button"
              className={MENU_ITEM}
              onClick={() => {
                void openChatWindow(overlay.friend.id)
                setOverlay(null)
              }}
            >
              Send an Instant Message
            </button>
          </li>
          <li role="none">
            <button
              role="menuitem"
              type="button"
              className={MENU_ITEM}
              onClick={() => setOverlay({ kind: "profile", friend: overlay.friend })}
            >
              View Profile
            </button>
          </li>
          <li role="none">
            <button
              role="menuitem"
              type="button"
              className={MENU_ITEM}
              onClick={() => setOverlay({ kind: "confirm", friend: overlay.friend })}
            >
              Remove Friend
            </button>
          </li>
        </ul>
      ) : null}

      {overlay?.kind === "profile" ? (
        <div role="dialog" aria-label={`${overlay.friend.displayName}'s profile`} className="m-2 border p-2">
          <p className="m-0 font-bold">{overlay.friend.displayName}</p>
          {shouldShowField(overlay.friend.statusMessage) ? (
            <p className="m-0 text-xs">{overlay.friend.statusMessage}</p>
          ) : null}
          {hasNowPlaying(overlay.friend.nowPlaying) ? (
            <p className="m-0 text-xs">♪ {overlay.friend.nowPlaying}</p>
          ) : null}
          <button type="button" className="ym-button mt-1" autoFocus onClick={() => setOverlay(null)}>
            Close
          </button>
        </div>
      ) : null}

      {overlay?.kind === "confirm" ? (
        <div role="alertdialog" aria-label="Remove friend" className="m-2 border p-2">
          <p className="m-0">Remove {overlay.friend.displayName} from your friends?</p>
          <div className="mt-1 flex gap-1">
            <button type="button" className="ym-button" onClick={() => void doRemove(overlay.friend)}>
              Remove
            </button>
            <button type="button" className="ym-button" autoFocus onClick={() => setOverlay(null)}>
              Keep
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
