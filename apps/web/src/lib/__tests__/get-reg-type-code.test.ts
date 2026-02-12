import { describe, it, expect } from "vitest";
import { getRegTypeCode } from "../get-reg-type-code";

describe("getRegTypeCode", () => {
  it("returns code from array with items", () => {
    expect(getRegTypeCode([{ code: "UU" }])).toBe("UU");
  });

  it("returns code from single object", () => {
    expect(getRegTypeCode({ code: "PP" })).toBe("PP");
  });

  it('returns "" for null', () => {
    expect(getRegTypeCode(null)).toBe("");
  });

  it('returns "" for empty array', () => {
    expect(getRegTypeCode([])).toBe("");
  });
});
