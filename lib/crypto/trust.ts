/** Remembered public keys of friends, and what to do when one differs (ADR 0010, E3). */

export type KeyCheck =
  /** The friend has not published a key yet. */
  | { status: "missing" }
  /** First time this key is seen; remember it and go on. */
  | { status: "new" }
  /** Same key as remembered. */
  | { status: "ok" }
  /** A different key than the one remembered; the user must confirm. */
  | { status: "changed" }

/** `pinned` is the key remembered for this friend (null if none); `current` is what the server shows now. */
export function checkFriendKey(pinned: string | null, current: string | null): KeyCheck {
  if (current === null) return { status: "missing" }
  if (pinned === null) return { status: "new" }
  return pinned === current ? { status: "ok" } : { status: "changed" }
}

/**
 * The key to remember when the user taps "Trust the new key": the key now on
 * the server, but only if it is the one whose Safety Number they just compared.
 * If the server shows a different key by now, nothing is pinned and the user checks again.
 */
export function keyToPin(shown: string | null, current: string | null): string | null {
  if (shown === null || current === null) return null
  return shown === current ? current : null
}

export type SendGate = { allowed: true } | { allowed: false; reason: "missing" | "changed"; message: string }

/** Whether a message may go now, with the words to show when it may not. */
export function sendGate(check: KeyCheck, friendName: string): SendGate {
  if (check.status === "missing") {
    return { allowed: false, reason: "missing", message: `${friendName} hasn't set up encryption yet.` }
  }
  if (check.status === "changed") {
    return { allowed: false, reason: "changed", message: `${friendName}'s key changed. Check the Safety Number, then confirm to keep chatting.` }
  }
  return { allowed: true }
}

const pinsKey = (me: string) => `buzz:friend-keys:${me}`

export type Pins = Record<string, string>

/** Reads the remembered keys; anything malformed counts as none. */
export function parsePins(raw: string | null): Pins {
  if (!raw) return {}
  try {
    const v: unknown = JSON.parse(raw)
    if (typeof v !== "object" || v === null || Array.isArray(v)) return {}
    const out: Pins = {}
    for (const [id, key] of Object.entries(v as Record<string, unknown>)) {
      if (typeof key === "string") out[id] = key
    }
    return out
  } catch {
    return {}
  }
}

export function loadPins(store: Pick<Storage, "getItem">, me: string): Pins {
  return parsePins(store.getItem(pinsKey(me)))
}

/** Remembers `key` for `friendId`: the first sight, or the user's confirmation of a change. */
export function pinFriendKey(store: Pick<Storage, "getItem" | "setItem">, me: string, friendId: string, key: string): void {
  const pins = loadPins(store, me)
  pins[friendId] = key
  store.setItem(pinsKey(me), JSON.stringify(pins))
}
