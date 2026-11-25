const KEY = "buzz.profileNotice"

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage
  } catch {
    return null
  }
}

/** Leaves one message for the Profile window to show on its next open (static export has no server to carry it). */
export function setProfileNotice(message: string, storage: Pick<Storage, "setItem"> | null = store()): void {
  try {
    storage?.setItem(KEY, message)
  } catch {
    // Storage unavailable; the message is lost, which is acceptable.
  }
}

/** Returns the pending message once, then forgets it. */
export function takeProfileNotice(storage: Pick<Storage, "getItem" | "removeItem"> | null = store()): string | null {
  try {
    const m = storage?.getItem(KEY) ?? null
    if (m) storage?.removeItem(KEY)
    return m
  } catch {
    return null
  }
}
