import { describe, it, expect } from "vitest";
import { parseMultiParam, toggleMultiParam } from "../multi-select-params";

describe("parseMultiParam", () => {
  it("returns empty array for undefined", () => {
    expect(parseMultiParam(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseMultiParam("")).toEqual([]);
  });

  it("parses single value", () => {
    expect(parseMultiParam("UU")).toEqual(["UU"]);
  });

  it("parses multiple comma-separated values", () => {
    expect(parseMultiParam("UU,PP,PERPRES")).toEqual(["UU", "PP", "PERPRES"]);
  });

  it("filters empty segments from double comma", () => {
    expect(parseMultiParam("UU,,PP")).toEqual(["UU", "PP"]);
  });

  it("filters trailing comma", () => {
    expect(parseMultiParam("UU,PP,")).toEqual(["UU", "PP"]);
  });

  it("trims whitespace from values", () => {
    expect(parseMultiParam("UU, PP, PERPRES")).toEqual(["UU", "PP", "PERPRES"]);
  });

  it("filters whitespace-only segments", () => {
    expect(parseMultiParam("UU, , PP")).toEqual(["UU", "PP"]);
  });
});

describe("toggleMultiParam", () => {
  it("adds value when not present", () => {
    expect(toggleMultiParam([], "UU")).toBe("UU");
  });

  it("removes value when present", () => {
    expect(toggleMultiParam(["UU"], "UU")).toBeUndefined();
  });

  it("returns undefined when last value removed", () => {
    expect(toggleMultiParam(["berlaku"], "berlaku")).toBeUndefined();
  });

  it("adds to existing selection", () => {
    expect(toggleMultiParam(["UU"], "PP")).toBe("UU,PP");
  });

  it("preserves order of remaining values after removal", () => {
    expect(toggleMultiParam(["UU", "PP", "PERPRES"], "PP")).toBe(
      "UU,PERPRES",
    );
  });
});
