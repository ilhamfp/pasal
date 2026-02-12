import { describe, it, expect } from "vitest";
import { parseSlug } from "../parse-slug";

describe("parseSlug", () => {
  it('parses "uu-13-2003"', () => {
    expect(parseSlug("uu-13-2003")).toEqual({ lawNumber: "13", lawYear: 2003 });
  });

  it('parses "pp-35-2021"', () => {
    expect(parseSlug("pp-35-2021")).toEqual({ lawNumber: "35", lawYear: 2021 });
  });

  it('handles extra dashes: "perpres-foo-bar-17-2020"', () => {
    expect(parseSlug("perpres-foo-bar-17-2020")).toEqual({
      lawNumber: "17",
      lawYear: 2020,
    });
  });

  it('returns null for too few parts: "too-short"', () => {
    expect(parseSlug("too-short")).toBeNull();
  });

  it('returns null when year is NaN: "uu-13-notanumber"', () => {
    expect(parseSlug("uu-13-notanumber")).toBeNull();
  });
});
