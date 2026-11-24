import { describe, it, expect } from "vitest"
import { requestErrorMessage } from "../requestErrors"

describe("requestErrorMessage", () => {
  it("explains the one-hour wait after a decline", () => {
    expect(requestErrorMessage({ message: "friendships: wait before asking again" })).toMatch(/ask again in an hour/)
  })
  it("explains the hourly request limit", () => {
    expect(requestErrorMessage({ message: "friendships: too many requests" })).toMatch(/a lot of friend requests/)
  })
  it("falls back to the generic line", () => {
    expect(requestErrorMessage({ message: "something else" })).toBe("Something went wrong. Please try again.")
    expect(requestErrorMessage(null)).toBe("Something went wrong. Please try again.")
  })
})
