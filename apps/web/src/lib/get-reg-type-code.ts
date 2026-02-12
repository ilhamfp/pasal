export function getRegTypeCode(
  regTypes: { code: string }[] | { code: string } | null,
): string {
  if (Array.isArray(regTypes)) {
    return regTypes[0]?.code || "";
  }
  return regTypes?.code || "";
}
