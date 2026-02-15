const BASE = "https://pasal.id";

/**
 * Generates hreflang alternates for bilingual pages.
 * Indonesian (default) uses unprefixed URLs, English uses /en prefix.
 */
export function getAlternates(path: string, locale: string) {
  const idPath = `${BASE}${path}`;
  const enPath = `${BASE}/en${path}`;

  return {
    canonical: locale === "id" ? idPath : enPath,
    languages: {
      id: idPath,
      en: enPath,
      "x-default": idPath, // Indonesian is the default
    },
  };
}
