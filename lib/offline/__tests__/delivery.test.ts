import { describe, it, expect } from "vitest";
import { planDelivery } from "../delivery";

const row = (id: string, sender_id: string, created_at: string) => ({ id, sender_id, created_at });

describe("planDelivery", () => {
  it("counts waiting messages per sender for the buddy list badges", () => {
    const plan = planDelivery([
      row("m1", "ann", "2025-01-01T10:00:00Z"),
      row("m2", "bob", "2025-01-01T10:01:00Z"),
      row("m3", "ann", "2025-01-01T10:02:00Z"),
    ]);
    expect(plan.unreadBySender).toEqual({ ann: 2, bob: 1 });
  });

  it("delivers oldest first even when rows arrive out of order (Req 9.2)", () => {
    const plan = planDelivery([
      row("late", "ann", "2025-01-01T12:00:00Z"),
      row("early", "bob", "2025-01-01T09:00:00Z"),
      row("mid", "ann", "2025-01-01T10:30:00+01:00"), // 09:30Z
    ]);
    expect(plan.ordered.map((m) => m.id)).toEqual(["early", "mid", "late"]);
  });
});
