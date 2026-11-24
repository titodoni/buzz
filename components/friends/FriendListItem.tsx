"use client"

import type { KeyboardEvent, MouseEvent } from "react"
import { PresenceDot } from "@/components/PresenceDot"
import type { PresenceState } from "@/lib/presence/state"
import { hasNowPlaying, shouldShowField, shownNowPlaying } from "@/lib/profile/render"
import type { FriendEntry } from "@/lib/friends/api"
import { isFriendUpForChat } from "@/lib/status/sayHi"

export interface FriendListItemProps {
  friend: FriendEntry
  presence: PresenceState
  /** Messages waiting from this friend. */
  unread?: number
  /** Nudges from this friend whose Chat Window could not take focus (red count, buzz-trigger R4.2). */
  nudgeBadge?: number
  /** True for a moment after a Nudge arrives: the row shakes (R4.1). */
  shaking?: boolean
  /** Online friends are bold, offline ones normal weight (Req 14.6). */
  bold?: boolean
  onOpen: (friendId: string) => void
  /** One tap on "Say hi" for a friend who is Up for Chat. */
  onSayHi?: (friend: FriendEntry) => void
  onContextMenu: (friend: FriendEntry, x: number, y: number) => void
}

export function FriendListItem({ friend, presence, unread, nudgeBadge, shaking, bold = true, onOpen, onSayHi, onContextMenu }: FriendListItemProps) {
  function onKeyDown(e: KeyboardEvent<HTMLLIElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      onOpen(friend.id)
    } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      e.preventDefault()
      const r = e.currentTarget.getBoundingClientRect()
      onContextMenu(friend, r.left + 24, r.bottom)
    }
  }
  function onRightClick(e: MouseEvent) {
    e.preventDefault()
    onContextMenu(friend, e.clientX, e.clientY)
  }

  const upForChat = isFriendUpForChat(friend.statusMessage, presence)
  return (
    <li
      className={`ym-row${upForChat ? " ym-up-for-chat" : ""}${shaking ? " ym-shake" : ""}${presence === "offline" ? " ym-offline" : ""} flex cursor-pointer items-center gap-1.5 px-2 py-0.5`}
      tabIndex={0}
      aria-label={`${friend.displayName}, ${presence}${unread ? `, ${unread} waiting` : ""}${nudgeBadge ? `, ${nudgeBadge} missed ${nudgeBadge === 1 ? "Buzz" : "Buzzes"}` : ""}${upForChat ? ", up for chat" : ""}. Press Enter to chat.`}
      onDoubleClick={() => onOpen(friend.id)}
      onKeyDown={onKeyDown}
      onContextMenu={onRightClick}
    >
      <PresenceDot state={presence} />
      <div className="min-w-0 flex-1 truncate">
        <span className={bold ? "font-bold" : ""}>{friend.displayName}</span>
        {unread && unread > 0 ? <span className={bold ? "font-bold" : ""}> ({unread})</span> : null}
        {nudgeBadge && nudgeBadge > 0 ? (
          <span
            className="ml-1 rounded px-1 text-xs font-bold"
            style={{ background: "var(--buzz-red)", color: "#fff" }}
            title="Buzz! waiting"
          >
            {nudgeBadge}
          </span>
        ) : null}
        {hasNowPlaying(friend.nowPlaying) ? (
          <span className="ym-now-playing" title={friend.nowPlaying ?? undefined}>
            {" "}
            <span aria-hidden="true">♪</span> {shownNowPlaying(friend.nowPlaying ?? "")}
          </span>
        ) : shouldShowField(friend.statusMessage) ? (
          <span className="ym-friend-sub" title={friend.statusMessage ?? undefined}>
            {" "}- {friend.statusMessage}
          </span>
        ) : null}
      </div>
      {upForChat && onSayHi ? (
        <button
          type="button"
          className="ym-button shrink-0 px-2 text-xs"
          style={{ minHeight: 22, padding: "0 8px" }}
          aria-label={`Say hi to ${friend.displayName}`}
          onClick={(e) => {
            e.stopPropagation()
            onSayHi(friend)
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          Say hi
        </button>
      ) : null}
    </li>
  )
}
