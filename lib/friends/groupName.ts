import { DEFAULT_GROUP_NAME } from "./arrange"

/** Longest group name; the database checks the same limit. */
export const GROUP_NAME_MAX = 40

const key = (s: string) => s.trim().toLowerCase()

/**
 * Why a group name can't be used, or null when it can. `currentName` is the
 * group's own name when renaming, so keeping it unchanged is allowed.
 */
export function groupNameError(name: string, existing: readonly string[], currentName?: string): string | null {
  const trimmed = name.trim()
  if (trimmed === "") return "Give the group a name."
  if (trimmed.length > GROUP_NAME_MAX) return `Group names can be up to ${GROUP_NAME_MAX} characters.`
  if (key(trimmed) === key(DEFAULT_GROUP_NAME)) return `"${DEFAULT_GROUP_NAME}" is already your main group. Pick another name.`
  const taken = existing.some((n) => key(n) === key(trimmed) && (currentName === undefined || key(n) !== key(currentName)))
  if (taken) return `You already have a group called "${trimmed}".`
  return null
}
