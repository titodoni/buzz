import { describe, it, expect } from "vitest";
import { shouldBroadcastTyping } from "../broadcast";

describe("shouldBroadcastTyping", () => {
  it("broadcasts on the first keystroke", () => {
    expect(shouldBroadcastTyping(null, 5_000)).toBe(true);
  });

  it("stays quiet for keystrokes within 1 second of the last broadcast", () => {
    expect(shouldBroadcastTyping(5_000, 5_999)).toBe(false);
  });

  it("broadcasts again once 1 second has passed, well inside the 3 s indicator window", () => {
    expect(shouldBroadcastTyping(5_000, 6_000)).toBe(true);
  });
});
