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

const historyKey = (me: string) => `buzz:friend-key-history:${me}`

/** Every key the user ever accepted per friend; malformed data counts as none. */
export function parseHistory(raw: string | null): Record<string, string[]> {
  if (!raw) return {}
  try {
    const v: unknown = JSON.parse(raw)
    if (typeof v !== "object" || v === null || Array.isArray(v)) return {}
    const out: Record<string, string[]> = {}
    for (const [id, keys] of Object.entries(v as Record<string, unknown>)) {
      if (Array.isArray(keys)) out[id] = keys.filter((k): k is string => typeof k === "string")
    }
    return out
  } catch {
    return {}
  }
}

/** Remembers `key` for `friendId`: the first sight, or the user's confirmation of a change. */
export function pinFriendKey(store: Pick<Storage, "getItem" | "setItem">, me: string, friendId: string, key: string): void {
  const pins = loadPins(store, me)
  pins[friendId] = key
  store.setItem(pinsKey(me), JSON.stringify(pins))
  const history = parseHistory(store.getItem(historyKey(me)))
  const keys = history[friendId] ?? []
  if (!keys.includes(key)) history[friendId] = [...keys, key]
  store.setItem(historyKey(me), JSON.stringify(history))
}

/** The keys a friend's messages may carry: the pinned one and every one accepted before it. */
export function acceptedKeys(store: Pick<Storage, "getItem">, me: string, friendId: string): string[] {
  const keys = parseHistory(store.getItem(historyKey(me)))[friendId] ?? []
  const pinned = loadPins(store, me)[friendId]
  return pinned && !keys.includes(pinned) ? [...keys, pinned] : keys
}

/**
 * Ensures first-sight trust for a friend uses their currently published key
 * (Option 1 for ADR 0010 / issue #8) rather than pinning an older key found
 * in chat history. No-op once any key has already been accepted for this friend.
 */
export async function seedFriendTrust(
  store: Pick<Storage, "getItem" | "setItem">,
  me: string,
  friendId: string,
  fetchKey: (id: string) => Promise<string | null>,
): Promise<string | null> {
  const existing = acceptedKeys(store, me, friendId)
  if (existing.length > 0) return loadPins(store, me)[friendId] ?? existing[existing.length - 1]
  const current = await fetchKey(friendId)
  if (current !== null) pinFriendKey(store, me, friendId, current)
  return current
}

/**
 * Whether a received message's sender key may be used. Only keys previously
 * accepted for this friend (seeded from their published key on first sight,
 * or confirmed via Safety Number) pass; unpinned or older keys stay unread
 * until verified rather than poisoning first-sight trust from history.
 */
export function trustReceivedKey(store: Pick<Storage, "getItem">, me: string, friendId: string, key: string): boolean {
  return acceptedKeys(store, me, friendId).includes(key)
}
