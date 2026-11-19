import { describe, it, expect } from "vitest";
import { presenceLabel } from "../PresenceDot";

describe("presenceLabel", () => {
  it("maps each state to its label", () => {
    expect(presenceLabel("online")).toBe("Online");
    expect(presenceLabel("away")).toBe("Away");
    expect(presenceLabel("busy")).toBe("Busy");
    expect(presenceLabel("offline")).toBe("Offline");
  });
});
