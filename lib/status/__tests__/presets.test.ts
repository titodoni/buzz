import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  PRESET_STATUSES,
  applyPreset,
  chooseAvailable,
  customStatus,
  isPresetStatus,
} from "../presets";

// Feature: buzz, status presets (Req 12.3, 12.4, 12.5)
describe("applyPreset", () => {
  it("lists the seven presets", () => {
    expect([...PRESET_STATUSES]).toEqual([
      "Be Right Back",
      "Not at My Desk",
      "Not in Office",
      "On the Phone",
      "On Vacation",
      "Out to Lunch",
      "Stepped Out",
    ]);
  });

  it("every preset sets its own text and makes the user Busy", () => {
    for (const name of PRESET_STATUSES) {
      expect(applyPreset(name)).toEqual({ text: name, availability: "busy" });
    }
  });
});

describe("chooseAvailable", () => {
  it("clears a status that came from a preset, whatever its case or spacing", () => {
    for (const name of PRESET_STATUSES) {
      expect(chooseAvailable(name)).toEqual({ text: null, availability: "online" });
      expect(chooseAvailable(`  ${name.toUpperCase()} `)).toEqual({ text: null, availability: "online" });
    }
  });

  it("keeps a status the user wrote themselves", () => {
    expect(chooseAvailable("Working on the demo")).toEqual({ text: "Working on the demo", availability: "online" });
  });

  it("keeps no status when there was none", () => {
    expect(chooseAvailable(null)).toEqual({ text: null, availability: "online" });
    expect(chooseAvailable("")).toEqual({ text: null, availability: "online" });
  });

  it("never keeps a preset text, for any input", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const out = chooseAvailable(text);
        expect(out.availability).toBe("online");
        expect(out.text === null || !isPresetStatus(out.text)).toBe(true);
      }),
    );
  });
});

describe("customStatus", () => {
  it("keeps the chosen availability and trims the text", () => {
    expect(customStatus("  deep in code ", "busy")).toEqual({ text: "deep in code", availability: "busy" });
    expect(customStatus("hi!", "online")).toEqual({ text: "hi!", availability: "online" });
  });

  it("treats empty or blank text as no status", () => {
    expect(customStatus("   ", "busy")).toEqual({ text: null, availability: "busy" });
    expect(customStatus("", "online")).toEqual({ text: null, availability: "online" });
  });
});
