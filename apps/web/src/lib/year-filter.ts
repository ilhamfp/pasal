export type YearPreset = "5y" | "10y" | "20y";

const PRESET_OFFSETS: Record<YearPreset, number> = {
  "5y": 5,
  "10y": 10,
  "20y": 20,
};

export function isYearPreset(value: string | undefined): value is YearPreset {
  return value === "5y" || value === "10y" || value === "20y";
}

export function isCustomRange(value: string | undefined): boolean {
  if (!value) return false;
  const m = value.match(/^from:(\d{4})$/);
  return !!m && parseInt(m[1], 10) >= 1945;
}

export function getRangeFromYear(value: string): number {
  if (isYearPreset(value)) {
    return new Date().getFullYear() - PRESET_OFFSETS[value] + 1;
  }
  const fromMatch = value.match(/^from:(\d{4})$/);
  if (fromMatch) return parseInt(fromMatch[1], 10);
  return new Date().getFullYear();
}

export function parseYearParam(
  value: string | undefined,
): { type: "exact"; year: number } | { type: "range"; yearFrom: number } | null {
  if (!value) return null;

  if (isYearPreset(value)) {
    const offset = PRESET_OFFSETS[value];
    return { type: "range", yearFrom: new Date().getFullYear() - offset + 1 };
  }

  const fromMatch = value.match(/^from:(\d{4})$/);
  if (fromMatch) {
    const y = parseInt(fromMatch[1], 10);
    if (y >= 1945) return { type: "range", yearFrom: y };
  }

  const year = parseInt(value, 10);
  if (!isNaN(year) && /^\d{4}$/.test(value) && year >= 1945) {
    return { type: "exact", year };
  }

  return null;
}

export function yearParamToMetadataFilter(
  value: string | undefined,
): { year?: string; year_from?: string } {
  const parsed = parseYearParam(value);
  if (!parsed) return {};

  if (parsed.type === "exact") {
    return { year: String(parsed.year) };
  }

  return { year_from: String(parsed.yearFrom) };
}
