"use client"

import type { FormEvent } from "react"
import { SafetyNumber } from "@/components/chat/SafetyNumber"
import type { FriendEntry } from "@/lib/friends/api"
import { DEFAULT_GROUP_NAME } from "@/lib/friends/arrange"
import type { ContactGroup } from "@/lib/friends/groups"
import type { KeyPair } from "@/lib/crypto/box"
import { hasNowPlaying, shouldShowField } from "@/lib/profile/render"

// The small dialogs the Buddy List opens from a friend's or a group's context menu.
// They only draw; FriendList decides what each button does.

const MENU_ITEM = "ym-row block w-full cursor-pointer border-0 bg-transparent px-3 py-1 text-left"
const viewKey = (id: string | null) => id ?? "default"

export function MoveDialog(props: {
  friend: FriendEntry
  groups: readonly ContactGroup[]
  onMove(groupId: string | null): void
  onCancel(): void
}) {
  return (
    <div
      role="dialog"
      aria-label={`Move ${props.friend.displayName} to a group`}
      className="m-2 border p-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onCancel()
      }}
    >
      <p className="m-0 text-xs font-bold">Move {props.friend.displayName} to:</p>
      <ul className="m-0 mt-1 list-none p-0">
        {[{ id: null as string | null, name: DEFAULT_GROUP_NAME }, ...props.groups].map((g, i) => (
          <li key={viewKey(g.id)}>
            <button
              type="button"
              className={MENU_ITEM}
              // Focus lands in the dialog, so keyboard users don't have to Tab past the list.
              autoFocus={i === 0}
              onClick={() => props.onMove(g.id)}
            >
              {g.name}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="ym-button mt-1" onClick={props.onCancel}>
        Cancel
      </button>
    </div>
  )
}

export function RenameDialog(props: {
  group: ContactGroup
  text: string
  error: string | null
  onTextChange(text: string): void
  onSubmit(e: FormEvent): void
  onCancel(): void
}) {
  return (
    <form
      role="dialog"
      aria-label={`Rename the ${props.group.name} group`}
      className="m-2 border p-2"
      onSubmit={props.onSubmit}
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onCancel()
      }}
    >
      <label className="block text-xs font-bold">
        New name
        <input
          type="text"
          autoFocus
          value={props.text}
          onChange={(e) => props.onTextChange(e.target.value)}
          className="mt-1 block w-full font-normal"
        />
      </label>
      {props.error ? (
        <p role="alert" className="m-0 text-xs" style={{ color: "var(--buzz-red)" }}>
          {props.error}
        </p>
      ) : null}
      <div className="mt-1 flex gap-1">
        <button type="submit" className="ym-button">
          Rename
        </button>
        <button type="button" className="ym-button" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export function DeleteGroupDialog(props: { group: ContactGroup; onDelete(): void; onKeep(): void }) {
  return (
    <div role="alertdialog" aria-label="Delete group" className="m-2 border p-2">
      <p className="m-0 text-xs">
        Delete {props.group.name}? Its friends move back to {DEFAULT_GROUP_NAME}. Nobody is removed.
      </p>
      <div className="mt-1 flex gap-1">
        <button type="button" className="ym-button" onClick={props.onDelete}>
          Delete
        </button>
        <button type="button" className="ym-button" autoFocus onClick={props.onKeep}>
          Keep
        </button>
      </div>
    </div>
  )
}

export function IgnoreDialog(props: { friend: FriendEntry; onIgnore(): void; onCancel(): void }) {
  return (
    <div
      role="alertdialog"
      aria-label={`Ignore ${props.friend.displayName}`}
      className="m-2 border p-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onCancel()
      }}
    >
      <p className="m-0 text-xs">
        Ignore {props.friend.displayName}? They won&apos;t be able to message you, Buzz you, or send you friend
        requests, and they&apos;ll see you as offline. Buzz won&apos;t tell them.
      </p>
      <div className="mt-1 flex gap-1">
        <button type="button" className="ym-button" onClick={props.onIgnore}>
          Ignore
        </button>
        <button type="button" className="ym-button" autoFocus onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export function ProfileDialog(props: { friend: FriendEntry; keys: KeyPair | "unavailable" | null; onClose(): void }) {
  const { friend, keys } = props
  return (
    <div role="dialog" aria-label={`${friend.displayName}'s profile`} className="m-2 border p-2">
      <p className="m-0 font-bold">{friend.displayName}</p>
      {shouldShowField(friend.statusMessage) ? <p className="m-0 text-xs">{friend.statusMessage}</p> : null}
      {hasNowPlaying(friend.nowPlaying) ? <p className="m-0 text-xs">♪ {friend.nowPlaying}</p> : null}
      {keys !== null && keys !== "unavailable" ? (
        <SafetyNumber myPublicKey={keys.publicKey} friendId={friend.id} friendName={friend.displayName} />
      ) : null}
      <button type="button" className="ym-button mt-1" autoFocus onClick={props.onClose}>
        Close
      </button>
    </div>
  )
}

export function RemoveFriendDialog(props: { friend: FriendEntry; onRemove(): void; onKeep(): void }) {
  return (
    <div role="alertdialog" aria-label="Remove friend" className="m-2 border p-2">
      <p className="m-0">Remove {props.friend.displayName} from your friends?</p>
      <div className="mt-1 flex gap-1">
        <button type="button" className="ym-button" onClick={props.onRemove}>
          Remove
        </button>
        <button type="button" className="ym-button" autoFocus onClick={props.onKeep}>
          Keep
        </button>
      </div>
    </div>
  )
}
