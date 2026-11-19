"use client"

import type { ConversationItem } from "./conversation"

/**
 * The conversation on screen as plain text (Req 17.7): one line per message,
 * "Name (hh:mm): text", and system lines as they read.
 */
export function conversationText(
  items: readonly ConversationItem[],
  names: { mine: string; friend: string },
  time: (iso: string) => string,
): string {
  return items
    .map((i) => (i.kind === "system" ? i.text : `${i.mine ? names.mine : names.friend} (${time(i.createdAt)}): ${i.body}`))
    .join("\n")
}

/** Puts text on the clipboard; false if neither the Clipboard API nor the fallback worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older WebKitGTK, or no permission: fall back to a hidden text box.
  }
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const box = document.createElement("textarea")
  box.value = text
  box.setAttribute("readonly", "")
  box.style.position = "fixed"
  box.style.opacity = "0"
  document.body.appendChild(box)
  box.select()
  let ok = false
  try {
    ok = document.execCommand("copy")
  } catch {
    ok = false
  }
  box.remove()
  before?.focus()
  return ok
}
