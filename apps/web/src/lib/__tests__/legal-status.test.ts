import { describe, it, expect } from "vitest";
import { STATUS_COLORS, STATUS_LABELS } from "../legal-status";

describe("legal-status constants", () => {
  const statuses = ["berlaku", "diubah", "dicabut", "tidak_berlaku"];

  it("STATUS_COLORS has entries for all statuses", () => {
    for (const s of statuses) {
      expect(STATUS_COLORS).toHaveProperty(s);
      expect(STATUS_COLORS[s]).toBeTruthy();
    }
  });

  it("STATUS_LABELS has entries for all statuses", () => {
    for (const s of statuses) {
      expect(STATUS_LABELS).toHaveProperty(s);
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
  });
});
