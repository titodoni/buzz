"use client"

import { agoText, RECENT_NUDGES_EMPTY, type RecentNudge } from "@/lib/nudge/recent"
import type { PresenceState } from "@/lib/presence/state"

/**
 * The bell's popover: the last 10 Buzzes I received, newest first, with
 * "Nudge back" (buzz-trigger R4.3, R4.4). The log lives on this computer only.
 */
export function RecentNudgesPanel({
  items,
  names,
  presence,
  now,
  note,
  onNudgeBack,
  onClose,
}: {
  items: readonly RecentNudge[]
  names: ReadonlyMap<string, string>
  presence: Readonly<Record<string, PresenceState>>
  now: number
  note: string | null
  onNudgeBack: (friendId: string) => void
  onClose: () => void
}) {
  return (
    <section aria-label="Recent Buzzes" className="border-b px-2 py-1">
      <div className="flex items-center gap-1">
        <h2 className="m-0 min-w-0 flex-1 text-xs font-bold">Recent Buzzes</h2>
        <button type="button" className="ym-button" onClick={onClose}>
          Close
        </button>
      </div>
      {items.length === 0 ? (
        <p className="m-0 py-1 text-xs">{RECENT_NUDGES_EMPTY}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.map((n) => {
            const name = names.get(n.senderId) ?? "A friend"
            const offline = (presence[n.senderId] ?? "offline") === "offline"
            return (
              <li key={`${n.senderId}-${n.receivedAt}`} className="ym-row flex items-center gap-1 px-1 py-1">
                <span className="min-w-0 flex-1 truncate">
                  <strong>{name}</strong> <span className="text-xs">{agoText(n.receivedAt, now)}</span>
                </span>
                <button
                  type="button"
                  className="ym-button"
                  disabled={offline}
                  title={offline ? `${name} is offline` : undefined}
                  onClick={() => onNudgeBack(n.senderId)}
                >
                  Nudge back
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p role="status" aria-live="polite" className="m-0 min-h-4 text-xs">
        {note ?? ""}
      </p>
    </section>
  )
}
