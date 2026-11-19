/** How this device shows the Buddy List (Req 14.7, 14.8). */
export interface BuddyView {
  showOffline: boolean
  /** Collapsed groups: a group id, or "default" for the default group. */
  collapsed: string[]
}

export const DEFAULT_BUDDY_VIEW: BuddyView = { showOffline: true, collapsed: [] }

/** Reads the saved view; anything missing or damaged falls back to the default. */
export function parseBuddyView(raw: string | null): BuddyView {
  let value: unknown = null
  try {
    value = raw === null ? null : JSON.parse(raw)
  } catch {
    value = null
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return DEFAULT_BUDDY_VIEW
  const read = (key: string): unknown => Object.getOwnPropertyDescriptor(value, key)?.value
  const show = read("showOffline")
  const collapsed = read("collapsed")
  return {
    showOffline: typeof show === "boolean" ? show : DEFAULT_BUDDY_VIEW.showOffline,
    collapsed: Array.isArray(collapsed) ? collapsed.filter((x): x is string => typeof x === "string") : [],
  }
}

/** Collapses a group, or expands it if it was collapsed. */
export function toggleCollapsed(view: BuddyView, key: string): BuddyView {
  const collapsed = view.collapsed.includes(key) ? view.collapsed.filter((k) => k !== key) : [...view.collapsed, key]
  return { ...view, collapsed }
}
