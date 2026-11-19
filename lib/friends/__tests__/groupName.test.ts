import { describe, it, expect } from "vitest"
import { GROUP_NAME_MAX, groupNameError } from "../groupName"

describe("groupNameError (Req 14.2)", () => {
  it("accepts a new name and allows 40 characters", () => {
    expect(GROUP_NAME_MAX).toBe(40)
    expect(groupNameError("Family", [])).toBeNull()
    expect(groupNameError("x".repeat(40), [])).toBeNull()
  })

  it("rejects an empty or too-long name", () => {
    expect(groupNameError("   ", [])).toBe("Give the group a name.")
    expect(groupNameError("x".repeat(41), [])).toBe("Group names can be up to 40 characters.")
  })

  it("keeps 'Friends' for the default group", () => {
    expect(groupNameError(" friends ", [])).toBe('"Friends" is already your main group. Pick another name.')
  })

  it("rejects a name the user already has, ignoring case and spaces", () => {
    expect(groupNameError(" FAMILY ", ["Family", "Work"])).toBe('You already have a group called "FAMILY".')
  })

  it("lets a group keep its own name when renaming", () => {
    expect(groupNameError("Family", ["Family", "Work"], "Family")).toBeNull()
  })
})
