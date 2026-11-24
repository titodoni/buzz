"use client"
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react"
import { removeFriend, type FriendEntry } from "@/lib/friends/api"
import { arrangeBuddyList, countOnline, DEFAULT_GROUP_NAME, type ArrangedGroup } from "@/lib/friends/arrange"
import type { BuddyView } from "@/lib/friends/buddyView"
import { deleteGroup, moveFriend, renameGroup, type ContactGroup, type GroupMembership } from "@/lib/friends/groups"
import { ignoreUser, unignoreUser } from "@/lib/friends/ignore"
import type { PresenceState } from "@/lib/presence/state"
import { sendEncryptedMessage } from "@/lib/chat/api"
import { DEFAULT_FORMAT } from "@/lib/chat/format"
import type { KeyPair } from "@/lib/crypto/box"
import { SAY_HI_TEXT, canSayHi } from "@/lib/status/sayHi"
import { openChatWindow } from "@/lib/tauri/windows"
import { FriendListItem } from "./FriendListItem"
import { DeleteGroupDialog, IgnoreDialog, MoveDialog, ProfileDialog, RemoveFriendDialog, RenameDialog } from "./FriendDialogs"

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
  | { kind: "ignore"; friend: FriendEntry }
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
  /** Red Nudge counts per friend id (buzz-trigger R4.2). */
  nudgeBadges?: Readonly<Record<string, number>>
  /** Friend ids whose row is shaking right now (R4.1). */
  shakingIds?: ReadonlySet<string>
  /** Called when I open a chat from a row, so its red count clears. */
  onChatOpened?: (friendId: string) => void
  /** People I have ignored (their menu offers Stop Ignoring). */
  ignoredIds: ReadonlySet<string>
  onIgnoreChanged: () => void
  /** My encryption key: a pair, "unavailable" with no keychain, or null while it loads (ADR 0010). */
  keys: KeyPair | "unavailable" | null
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
  nudgeBadges = {},
  shakingIds,
  onChatOpened,
  ignoredIds,
  onIgnoreChanged,
  keys,
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
  // When "Say hi" last went to each friend; set before the send so a fast second tap cannot double up.
  const sayHiAt = useRef(new Map<string, number>())
  const byId = new Map(friends.map((f) => [f.id, f]))
  const arranged = arrangeBuddyList({ friends, groups, memberships, presence, showOffline: view.showOffline, search })
  const onlineNow = countOnline(friends, presence)
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

  /** First tap sends the greeting and opens the chat; a second within 60 seconds only opens it (R2.3). */
  async function sayHi(f: FriendEntry) {
    const now = Date.now()
    if (!canSayHi(sayHiAt.current.get(f.id), now)) {
      void openChatWindow(f.id)
      return
    }
    sayHiAt.current.set(f.id, now)
    const online = (presence[f.id] ?? "offline") !== "offline"
    const res = await sendEncryptedMessage({
      me,
      friendId: f.id,
      friendName: f.displayName,
      body: SAY_HI_TEXT,
      format: DEFAULT_FORMAT,
      id: crypto.randomUUID(),
      delivered: online,
      keys,
    })
    if (!res.ok) {
      sayHiAt.current.delete(f.id)
      setNote(res.message)
    }
    // Opened after the insert, so the new window's history already holds the greeting.
    void openChatWindow(f.id)
  }
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
  async function doIgnore(f: FriendEntry, ignore: boolean) {
    const res = ignore ? await ignoreUser(me, f.id) : await unignoreUser(me, f.id)
    setOverlay(null)
    if (!res.ok) return setNote(res.message)
    setNote(ignore ? `You're ignoring ${f.displayName}.` : `You're no longer ignoring ${f.displayName}.`)
    onIgnoreChanged()
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
    <section aria-label="Friends" className="ym-list">
      {friends.length === 0 && !searching ? (
        <p className="px-2 text-xs">No friends yet. Tap “Add” to find someone!</p>
      ) : null}
      {searching && arranged.length === 0 ? <p className="px-2 text-xs">No friends match “{search.trim()}”.</p> : null}
      {friends.length > 0 && !searching ? (
        <p role="status" aria-live="polite" className="ym-friend-sub m-0 px-2 py-1 text-xs">
          {onlineNow > 0 ? `${onlineNow} online now` : "No one is around right now."}
        </p>
      ) : null}
      {arranged.map((g) => {
        const key = viewKey(g.id)
        // While searching, every matching group stays open so results are visible.
        const open = searching || !view.collapsed.includes(key)
        return (
          <div key={key} role="group" aria-label={`${g.name}, ${g.online} of ${g.total} online`}>
            <h2 className="ym-group-head m-0 text-sm">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onToggleGroup(key)}
                onKeyDown={(e) => onHeaderKey(e, g)}
                onContextMenu={(e) => onHeaderContext(e, g)}
                className="w-full cursor-pointer border-0 bg-transparent px-2 py-1 text-left font-bold"
                style={{ color: "var(--text-body)" }}
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
                      nudgeBadge={nudgeBadges[f.id]}
                      shaking={shakingIds?.has(f.id)}
                      onOpen={(id) => {
                        onChatOpened?.(id)
                        void openChatWindow(id)
                      }}
                      onSayHi={(friend) => void sayHi(friend)}
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
            {ignoredIds.has(overlay.friend.id) ? (
              <button role="menuitem" type="button" className={MENU_ITEM} onClick={() => void doIgnore(overlay.friend, false)}>
                Stop Ignoring
              </button>
            ) : (
              <button role="menuitem" type="button" className={MENU_ITEM} onClick={() => setOverlay({ kind: "ignore", friend: overlay.friend })}>
                Ignore...
              </button>
            )}
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
        <MoveDialog
          friend={overlay.friend}
          groups={groups}
          onMove={(groupId) => void doMove(overlay.friend, groupId)}
          onCancel={() => setOverlay(null)}
        />
      ) : null}
      {overlay?.kind === "rename" ? (
        <RenameDialog
          group={overlay.group}
          text={renameText}
          error={renameError}
          onTextChange={(text) => {
            setRenameText(text)
            setRenameError(null)
          }}
          onSubmit={(e) => void doRename(e, overlay.group)}
          onCancel={() => setOverlay(null)}
        />
      ) : null}
      {overlay?.kind === "deleteGroup" ? (
        <DeleteGroupDialog group={overlay.group} onDelete={() => void doDeleteGroup(overlay.group)} onKeep={() => setOverlay(null)} />
      ) : null}
      {overlay?.kind === "ignore" ? (
        <IgnoreDialog friend={overlay.friend} onIgnore={() => void doIgnore(overlay.friend, true)} onCancel={() => setOverlay(null)} />
      ) : null}
      {overlay?.kind === "profile" ? <ProfileDialog friend={overlay.friend} keys={keys} onClose={() => setOverlay(null)} /> : null}
      {overlay?.kind === "confirm" ? (
        <RemoveFriendDialog friend={overlay.friend} onRemove={() => void doRemove(overlay.friend)} onKeep={() => setOverlay(null)} />
      ) : null}
    </section>
  )
}
