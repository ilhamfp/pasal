/** Parse a comma-separated URL param into an array. */
export function parseMultiParam(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Toggle a value in a multi-select param. Returns the new comma-separated string, or undefined if empty. */
export function toggleMultiParam(
  current: string[],
  value: string,
): string | undefined {
  const set = new Set(current);
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
  return set.size > 0 ? Array.from(set).join(",") : undefined;
}
