"use client"
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react"
import { removeFriend, type FriendEntry } from "@/lib/friends/api"
import { arrangeBuddyList, DEFAULT_GROUP_NAME, type ArrangedGroup } from "@/lib/friends/arrange"
import type { BuddyView } from "@/lib/friends/buddyView"
import { deleteGroup, moveFriend, renameGroup, type ContactGroup, type GroupMembership } from "@/lib/friends/groups"
import type { PresenceState } from "@/lib/presence/state"
import { hasNowPlaying, shouldShowField } from "@/lib/profile/render"
import { openChatWindow } from "@/lib/tauri/windows"
import { FriendListItem } from "./FriendListItem"

/** Key used to remember a group's collapsed state; the default group has no id. */
const viewKey = (id: string | null) => id ?? "default"

type Overlay =
  | { kind: "menu"; friend: FriendEntry; x: number; y: number }
  | { kind: "groupMenu"; group: ContactGroup; x: number; y: number }
  | { kind: "profile"; friend: FriendEntry }
  | { kind: "confirm"; friend: FriendEntry }
  | { kind: "move"; friend: FriendEntry }
  | { kind: "rename"; group: ContactGroup }
  | { kind: "deleteGroup"; group: ContactGroup }
  | null

const MENU_ITEM = "ym-row block w-full cursor-pointer border-0 bg-transparent px-3 py-1 text-left"

export interface FriendListProps {
  me: string
  friends: FriendEntry[]
  groups: ContactGroup[]
  memberships: GroupMembership[]
  /** Friend id to state. Missing ids are treated as offline. */
  presence?: Record<string, PresenceState>
  /** Waiting messages per sender id, shown as "(n)" after the name. */
  unreadBySender?: Record<string, number>
  view: BuddyView
  /** Text from the Buddy List search box. */
  search: string
  onToggleGroup: (key: string) => void
  onChanged: () => void
  onGroupsChanged: () => void
}

export function FriendList({
  me,
  friends,
  groups,
  memberships,
  presence = {},
  unreadBySender = {},
  view,
  search,
  onToggleGroup,
  onChanged,
  onGroupsChanged,
}: FriendListProps) {
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [note, setNote] = useState<string | null>(null)
  const [renameText, setRenameText] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const byId = new Map(friends.map((f) => [f.id, f]))
  const arranged = arrangeBuddyList({ friends, groups, memberships, presence, showOffline: view.showOffline, search })
  const menuOpen = overlay?.kind === "menu" || overlay?.kind === "groupMenu"
  const searching = search.trim() !== ""

  useEffect(() => {
    if (!menuOpen) return
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus()
    const onMouse = (e: globalThis.MouseEvent) => {
      // event targets are typed EventTarget; a mousedown target is always a Node
      if (!menuRef.current?.contains(e.target as Node)) setOverlay(null)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
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
  async function doMove(f: FriendEntry, groupId: string | null) {
    const res = await moveFriend(me, f.id, groupId)
    setOverlay(null)
    if (!res.ok) return setNote(res.message)
    const name = groupId === null ? DEFAULT_GROUP_NAME : (groups.find((g) => g.id === groupId)?.name ?? "")
    setNote(`Moved ${f.displayName} to ${name}.`)
    onGroupsChanged()
  }
  async function doRename(e: FormEvent, group: ContactGroup) {
    e.preventDefault()
    const res = await renameGroup(group, renameText, groups)
    if (!res.ok) return setRenameError(res.message)
    setOverlay(null)
    onGroupsChanged()
  }
  async function doDeleteGroup(group: ContactGroup) {
    const res = await deleteGroup(group.id)
    setOverlay(null)
    if (!res.ok) return setNote(res.message)
    setNote(`Deleted ${group.name}. Its friends are back in ${DEFAULT_GROUP_NAME}.`)
    onGroupsChanged()
  }

  function openGroupMenu(group: ContactGroup, x: number, y: number) {
    setOverlay({ kind: "groupMenu", group, x, y })
  }
  function onHeaderKey(e: KeyboardEvent<HTMLButtonElement>, g: ArrangedGroup) {
    const group = groups.find((x) => x.id === g.id)
    if (!group) return
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      e.preventDefault()
      const r = e.currentTarget.getBoundingClientRect()
      openGroupMenu(group, r.left + 24, r.bottom)
    }
  }
  function onHeaderContext(e: MouseEvent<HTMLButtonElement>, g: ArrangedGroup) {
    const group = groups.find((x) => x.id === g.id)
    if (!group) return
    e.preventDefault()
    openGroupMenu(group, e.clientX, e.clientY)
  }

  const menuStyle = (x: number, y: number) => ({
    position: "fixed" as const,
    left: Math.max(0, Math.min(x, window.innerWidth - 180)),
    top: Math.max(0, Math.min(y, window.innerHeight - 140)),
    background: "var(--window-bg)",
    zIndex: 50,
    minWidth: 170,
  })

  return (
    <section aria-label="Friends">
      {friends.length === 0 && !searching ? (
        <p className="px-2 text-xs">No friends yet. Use “Add a Friend” to find someone!</p>
      ) : null}
      {searching && arranged.length === 0 ? <p className="px-2 text-xs">No friends match “{search.trim()}”.</p> : null}
      {arranged.map((g) => {
        const key = viewKey(g.id)
        // While searching, every matching group stays open so results are visible.
        const open = searching || !view.collapsed.includes(key)
        return (
          <div key={key} role="group" aria-label={`${g.name}, ${g.online} of ${g.total} online`}>
            <h2 className="m-0 text-sm">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onToggleGroup(key)}
                onKeyDown={(e) => onHeaderKey(e, g)}
                onContextMenu={(e) => onHeaderContext(e, g)}
                className="ym-row w-full cursor-pointer border-0 bg-transparent px-2 py-1 text-left font-bold"
                style={{ color: "var(--ym-blue)" }}
              >
                <span aria-hidden="true">{open ? "▼" : "▶"} </span>
                {g.name} ({g.online}/{g.total})
              </button>
            </h2>
            {open ? (
              <ul className="m-0 list-none p-0">
                {g.friends.map((a) => {
                  const f = byId.get(a.id)
                  if (!f) return null
                  return (
                    <FriendListItem
                      key={f.id}
                      friend={f}
                      presence={a.presence}
                      bold={a.bold}
                      unread={unreadBySender[f.id]}
                      onOpen={(id) => void openChatWindow(id)}
                      onContextMenu={(friend, x, y) => setOverlay({ kind: "menu", friend, x, y })}
                    />
                  )
                })}
              </ul>
            ) : null}
          </div>
        )
      })}
      <p role="status" className="min-h-4 px-2 text-xs">
        {note}
      </p>
      {overlay?.kind === "menu" ? (
        <ul
          ref={menuRef}
          role="menu"
          aria-label={`Options for ${overlay.friend.displayName}`}
          className="ym-dropdown m-0 list-none border p-0 shadow"
          style={menuStyle(overlay.x, overlay.y)}
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
            <button role="menuitem" type="button" className={MENU_ITEM} onClick={() => setOverlay({ kind: "move", friend: overlay.friend })}>
              Move to Group...
            </button>
          </li>
          <li role="none">
            <button role="menuitem" type="button" className={MENU_ITEM} onClick={() => setOverlay({ kind: "profile", friend: overlay.friend })}>
              View Profile
            </button>
          </li>
          <li role="none">
            <button role="menuitem" type="button" className={MENU_ITEM} onClick={() => setOverlay({ kind: "confirm", friend: overlay.friend })}>
              Remove Friend
            </button>
          </li>
        </ul>
      ) : null}
      {overlay?.kind === "groupMenu" ? (
        <ul
          ref={menuRef}
          role="menu"
          aria-label={`Options for the ${overlay.group.name} group`}
          className="ym-dropdown m-0 list-none border p-0 shadow"
          style={menuStyle(overlay.x, overlay.y)}
        >
          <li role="none">
            <button
              role="menuitem"
              type="button"
              className={MENU_ITEM}
              onClick={() => {
                setRenameText(overlay.group.name)
                setRenameError(null)
                setOverlay({ kind: "rename", group: overlay.group })
              }}
            >
              Rename Group...
            </button>
          </li>
          <li role="none">
            <button role="menuitem" type="button" className={MENU_ITEM} onClick={() => setOverlay({ kind: "deleteGroup", group: overlay.group })}>
              Delete Group
            </button>
          </li>
        </ul>
      ) : null}
      {overlay?.kind === "move" ? (
        <div
          role="dialog"
          aria-label={`Move ${overlay.friend.displayName} to a group`}
          className="m-2 border p-2"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOverlay(null)
          }}
        >
          <p className="m-0 text-xs font-bold">Move {overlay.friend.displayName} to:</p>
          <ul className="m-0 mt-1 list-none p-0">
            {[{ id: null as string | null, name: DEFAULT_GROUP_NAME }, ...groups].map((g, i) => (
              <li key={viewKey(g.id)}>
                <button
                  type="button"
                  className={MENU_ITEM}
                  // Focus lands in the dialog, so keyboard users don't have to Tab past the list.
                  autoFocus={i === 0}
                  onClick={() => void doMove(overlay.friend, g.id)}
                >
                  {g.name}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="ym-button mt-1" onClick={() => setOverlay(null)}>
            Cancel
          </button>
        </div>
      ) : null}
      {overlay?.kind === "rename" ? (
        <form
          role="dialog"
          aria-label={`Rename the ${overlay.group.name} group`}
          className="m-2 border p-2"
          onSubmit={(e) => void doRename(e, overlay.group)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOverlay(null)
          }}
        >
          <label className="block text-xs font-bold">
            New name
            <input
              type="text"
              autoFocus
              value={renameText}
              onChange={(e) => {
                setRenameText(e.target.value)
                setRenameError(null)
              }}
              className="mt-1 block w-full font-normal"
            />
          </label>
          {renameError ? (
            <p role="alert" className="m-0 text-xs" style={{ color: "var(--buzz-red)" }}>
              {renameError}
            </p>
          ) : null}
          <div className="mt-1 flex gap-1">
            <button type="submit" className="ym-button">
              Rename
            </button>
            <button type="button" className="ym-button" onClick={() => setOverlay(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {overlay?.kind === "deleteGroup" ? (
        <div role="alertdialog" aria-label="Delete group" className="m-2 border p-2">
          <p className="m-0 text-xs">
            Delete {overlay.group.name}? Its friends move back to {DEFAULT_GROUP_NAME}. Nobody is removed.
          </p>
          <div className="mt-1 flex gap-1">
            <button type="button" className="ym-button" onClick={() => void doDeleteGroup(overlay.group)}>
              Delete
            </button>
            <button type="button" className="ym-button" autoFocus onClick={() => setOverlay(null)}>
              Keep
            </button>
          </div>
        </div>
      ) : null}
      {overlay?.kind === "profile" ? (
        <div role="dialog" aria-label={`${overlay.friend.displayName}'s profile`} className="m-2 border p-2">
          <p className="m-0 font-bold">{overlay.friend.displayName}</p>
          {shouldShowField(overlay.friend.statusMessage) ? <p className="m-0 text-xs">{overlay.friend.statusMessage}</p> : null}
          {hasNowPlaying(overlay.friend.nowPlaying) ? <p className="m-0 text-xs">♪ {overlay.friend.nowPlaying}</p> : null}
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
