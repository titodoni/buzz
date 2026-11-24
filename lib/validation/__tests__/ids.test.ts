import { describe, it, expect } from "vitest"
import { isUuid } from "../ids"

describe("isUuid", () => {
  it("accepts a UUID in either case", () => {
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true)
    expect(isUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(true)
  })
  it("refuses everything else", () => {
    for (const bad of ["", "abc-123", "../x", "123e4567-e89b-12d3-a456-42661417400", "123e4567-e89b-12d3-a456-426614174000/x", null, undefined]) {
      expect(isUuid(bad)).toBe(false)
    }
  })
})
