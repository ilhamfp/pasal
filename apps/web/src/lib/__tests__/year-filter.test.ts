import { describe, it, expect } from "vitest";
import {
  isYearPreset,
  isCustomRange,
  getRangeFromYear,
  parseYearParam,
  yearParamToMetadataFilter,
} from "../year-filter";

const currentYear = new Date().getFullYear();

describe("isYearPreset", () => {
  it("returns true for valid presets", () => {
    expect(isYearPreset("5y")).toBe(true);
    expect(isYearPreset("10y")).toBe(true);
    expect(isYearPreset("20y")).toBe(true);
  });

  it("returns false for non-presets", () => {
    expect(isYearPreset(undefined)).toBe(false);
    expect(isYearPreset("")).toBe(false);
    expect(isYearPreset("3y")).toBe(false);
    expect(isYearPreset("from:2020")).toBe(false);
    expect(isYearPreset("2003")).toBe(false);
  });
});

describe("isCustomRange", () => {
  it("returns true for valid from:YYYY patterns", () => {
    expect(isCustomRange("from:2020")).toBe(true);
    expect(isCustomRange("from:1945")).toBe(true);
  });

  it("returns false for non-custom-range values", () => {
    expect(isCustomRange(undefined)).toBe(false);
    expect(isCustomRange("")).toBe(false);
    expect(isCustomRange("5y")).toBe(false);
    expect(isCustomRange("2003")).toBe(false);
    expect(isCustomRange("from:abc")).toBe(false);
    expect(isCustomRange("from:123")).toBe(false);
  });
});

describe("getRangeFromYear", () => {
  it("computes correct year for presets", () => {
    expect(getRangeFromYear("5y")).toBe(currentYear - 5 + 1);
    expect(getRangeFromYear("10y")).toBe(currentYear - 10 + 1);
    expect(getRangeFromYear("20y")).toBe(currentYear - 20 + 1);
  });

  it("extracts year from custom range", () => {
    expect(getRangeFromYear("from:2015")).toBe(2015);
    expect(getRangeFromYear("from:1945")).toBe(1945);
  });

});

describe("parseYearParam", () => {
  it("returns range for presets", () => {
    expect(parseYearParam("5y")).toEqual({
      type: "range",
      yearFrom: currentYear - 4,
    });
    expect(parseYearParam("10y")).toEqual({
      type: "range",
      yearFrom: currentYear - 9,
    });
    expect(parseYearParam("20y")).toEqual({
      type: "range",
      yearFrom: currentYear - 19,
    });
  });

  it("returns range for custom from:YYYY", () => {
    expect(parseYearParam("from:2015")).toEqual({
      type: "range",
      yearFrom: 2015,
    });
  });

  it("returns exact for 4-digit year", () => {
    expect(parseYearParam("2003")).toEqual({ type: "exact", year: 2003 });
  });

  it("accepts boundary year 1945", () => {
    expect(parseYearParam("1945")).toEqual({ type: "exact", year: 1945 });
    expect(parseYearParam("from:1945")).toEqual({
      type: "range",
      yearFrom: 1945,
    });
  });

  it("rejects years below 1945", () => {
    expect(parseYearParam("1944")).toBeNull();
    expect(parseYearParam("from:1944")).toBeNull();
    expect(parseYearParam("from:0000")).toBeNull();
  });

  it("returns null for empty/undefined", () => {
    expect(parseYearParam(undefined)).toBeNull();
    expect(parseYearParam("")).toBeNull();
  });

  it("returns null for malformed values", () => {
    expect(parseYearParam("from:abc")).toBeNull();
    expect(parseYearParam("123")).toBeNull();
    expect(parseYearParam("20001")).toBeNull();
    expect(parseYearParam("abc")).toBeNull();
    expect(parseYearParam("from:")).toBeNull();
  });
});

describe("yearParamToMetadataFilter", () => {
  it("returns empty object for undefined", () => {
    expect(yearParamToMetadataFilter(undefined)).toEqual({});
  });

  it("returns year_from for preset", () => {
    expect(yearParamToMetadataFilter("5y")).toEqual({
      year_from: String(currentYear - 4),
    });
  });

  it("returns year_from for custom range", () => {
    expect(yearParamToMetadataFilter("from:2010")).toEqual({
      year_from: "2010",
    });
  });

  it("returns year for exact year", () => {
    expect(yearParamToMetadataFilter("2003")).toEqual({ year: "2003" });
  });

  it("returns empty object for invalid input", () => {
    expect(yearParamToMetadataFilter("invalid")).toEqual({});
  });
});
