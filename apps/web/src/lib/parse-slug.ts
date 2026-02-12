export function parseSlug(slug: string): { lawNumber: string; lawYear: number } | null {
  const parts = slug.split("-");
  if (parts.length < 3) return null;
  const lawNumber = parts[parts.length - 2];
  const lawYear = parseInt(parts[parts.length - 1]);
  if (isNaN(lawYear)) return null;
  return { lawNumber, lawYear };
}
