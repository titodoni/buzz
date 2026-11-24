"use client"

import { PresenceDot } from "@/components/PresenceDot"
import type { PublicProfile } from "@/lib/friends/api"
import type { IgnoredPerson } from "@/lib/friends/ignore"
import type { InWindowToast } from "@/lib/alerts/useBuddyAlerts"

/** "New Group..." form under the search box. */
export function NewGroupForm(props: {
  name: string
  error: string | null
  onNameChange(name: string): void
  onSubmit(): void
  onCancel(): void
}) {
  return (
    <form
      aria-label="New group"
      className="border-b p-2"
      onSubmit={(e) => {
        e.preventDefault()
        props.onSubmit()
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onCancel()
      }}
    >
      <label className="block text-xs font-bold">
        Group name
        <input
          type="text"
          autoFocus
          value={props.name}
          onChange={(e) => props.onNameChange(e.target.value)}
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
          Create
        </button>
        <button type="button" className="ym-button" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** Actions > Send an Instant Message: pick who to talk to. */
export function PickFriendPanel(props: { friends: readonly PublicProfile[]; onPick(friendId: string): void }) {
  return (
    <section aria-label="Send an Instant Message" className="border-t px-2 py-1">
      <h2 className="m-0 text-xs font-bold">Who do you want to talk to?</h2>
      {props.friends.length === 0 ? <p className="text-xs">Add a friend first!</p> : null}
      <ul className="m-0 list-none p-0">
        {props.friends.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              className="ym-row w-full cursor-pointer border-0 bg-transparent px-1 py-1 text-left"
              onClick={() => props.onPick(f.id)}
            >
              {f.displayName}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Contacts > Ignore List. */
export function IgnoreListPanel(props: {
  ignored: readonly IgnoredPerson[]
  onRemove(person: IgnoredPerson): void
  onClose(): void
}) {
  return (
    <section
      aria-label="Ignore List"
      className="border-t px-2 py-1"
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onClose()
      }}
    >
      <h2 className="m-0 text-xs font-bold">Ignore List</h2>
      <p className="m-0 text-xs">People here can&apos;t message you, Buzz you, or send you friend requests.</p>
      {props.ignored.length === 0 ? <p className="m-0 mt-1 text-xs">You&apos;re not ignoring anyone.</p> : null}
      <ul className="m-0 mt-1 list-none p-0">
        {props.ignored.map((p) => (
          <li key={p.id} className="ym-row flex items-center gap-1 px-1 py-1">
            <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
            <button type="button" className="ym-button" onClick={() => props.onRemove(p)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="ym-button mt-1" autoFocus onClick={props.onClose}>
        Close
      </button>
    </section>
  )
}

/** Browser fallback for the desktop toast (Req 16.4, 16.5). */
export function ToastStack(props: {
  toasts: readonly InWindowToast[]
  onOpen(toast: InWindowToast): void
}) {
  if (props.toasts.length === 0) return null
  return (
    <div className="fixed right-2 bottom-2 z-50 flex flex-col gap-1" aria-live="polite">
      {props.toasts.map((t) => (
        <button
          key={t.key}
          type="button"
          className="ym-window ym-row flex items-center gap-2 px-3 py-2 text-left text-sm shadow"
          onClick={() => props.onOpen(t)}
        >
          <PresenceDot state="online" size={16} decorative />
          {t.text}
        </button>
      ))}
    </div>
  )
}
