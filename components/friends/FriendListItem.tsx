"use client"

import type { KeyboardEvent, MouseEvent } from "react"
import { PresenceDot } from "@/components/PresenceDot"
import type { PresenceState } from "@/lib/presence/state"
import { hasNowPlaying, shouldShowField } from "@/lib/profile/render"
import type { FriendEntry } from "@/lib/friends/api"

export interface FriendListItemProps {
  friend: FriendEntry
  presence: PresenceState
  /** Messages waiting from this friend. */
  unread?: number
  /** Online friends are bold, offline ones normal weight (Req 14.6). */
  bold?: boolean
  onOpen: (friendId: string) => void
  onContextMenu: (friend: FriendEntry, x: number, y: number) => void
}

export function FriendListItem({ friend, presence, unread, bold = true, onOpen, onContextMenu }: FriendListItemProps) {
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

  return (
    <li
      className="ym-row flex cursor-pointer items-start gap-2 px-2 py-1"
      style={{ opacity: presence === "offline" ? 0.55 : 1 }}
      tabIndex={0}
      aria-label={`${friend.displayName}, ${presence}${unread ? `, ${unread} waiting` : ""}. Press Enter to chat.`}
      onDoubleClick={() => onOpen(friend.id)}
      onKeyDown={onKeyDown}
      onContextMenu={onRightClick}
    >
      <PresenceDot state={presence} />
      <div className="min-w-0 flex-1">
        <div className={`truncate ${bold ? "font-bold" : ""}`}>
          {friend.displayName}
          {unread && unread > 0 ? <span> ({unread})</span> : null}
        </div>
        {shouldShowField(friend.statusMessage) ? (
          <div className="truncate text-xs">{friend.statusMessage}</div>
        ) : null}
        {hasNowPlaying(friend.nowPlaying) ? (
          <div className="truncate text-xs">
            <span aria-hidden="true">♪ </span>
            {friend.nowPlaying}
          </div>
        ) : null}
      </div>
    </li>
  )
}
