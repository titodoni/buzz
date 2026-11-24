import { describe, it, expect } from "vitest"
import { sharingNote } from "../note"

// Feature: buzz-trigger, Automatic Now Playing (R7.7): say honestly what is read on each system
describe("sharingNote", () => {
  it("confirms that sharing stopped", () => {
    for (const p of ["linux", "windows", "macos", "other"] as const)
      expect(sharingNote(false, p)).toBe("Buzz stopped sharing what you're playing.")
  })
  it("says only the artist and title are shared when it starts", () => {
    for (const p of ["linux", "windows"] as const)
      expect(sharingNote(true, p)).toBe("Friends now see what you're playing. Only the artist and title are shared.")
  })
  it("tells a Mac user that only Spotify and Apple Music are read, and that macOS will ask once", () => {
    const text = sharingNote(true, "macos")
    expect(text).toContain("Only the artist and title are shared.")
    expect(text).toContain("Spotify and Apple Music")
    expect(text).toContain("macOS may ask")
  })
})
