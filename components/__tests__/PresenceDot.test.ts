import { describe, it, expect } from "vitest";
import { presenceLabel } from "../PresenceDot";

describe("presenceLabel", () => {
  it("maps each state to its label", () => {
    expect(presenceLabel("online")).toBe("Online");
    expect(presenceLabel("away")).toBe("Away");
    expect(presenceLabel("busy")).toBe("Busy");
    expect(presenceLabel("offline")).toBe("Offline");
  });
  it("labels Invisible so the user knows friends see them offline (Req 12.8)", () => {
    expect(presenceLabel("invisible")).toBe("Invisible: friends see you as offline");
  });
});
