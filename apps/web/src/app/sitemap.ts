import type { MetadataRoute } from "next";
import { TOPICS } from "@/data/topics";
import { getRegTypeCode } from "@/lib/get-reg-type-code";
import { workSlug } from "@/lib/work-url";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const BASE = "https://pasal.id";
// Vercel ISR fallback pages must be <19MB. With hreflang alternates each URL is ~7KB,
// so 2500 URLs ≈ 17.5MB — safely under the limit.
const MAX_URLS_PER_SITEMAP = 2500;
const SUPABASE_PAGE_SIZE = 1000;

/** Cookie-free Supabase client for build-time sitemap generation (no request scope needed). */
function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Fixed date for static pages — updated when content changes meaningfully
const STATIC_DATE = new Date("2026-03-01");

// Static pages with hreflang alternates (no /search — it has noindex)
const STATIC_PATHS = ["", "/jelajahi", "/connect", "/api", "/topik"];

interface WorkRow {
  number: string;
  year: number;
  slug: string | null;
  updated_at: string | null;
  regulation_types: { code: string } | { code: string }[] | null;
}

export async function generateSitemaps() {
  const supabase = createClient();

  const [{ count: worksCount }, { data: regTypes }] = await Promise.all([
    supabase.from("works").select("id", { count: "exact", head: true }),
    supabase
      .from("regulation_types")
      .select("code, works(count)")
      .gt("works.count", 0),
  ]);

  const browseCount = (regTypes || []).filter((rt) => {
    const count = rt.works as unknown as { count: number }[];
    return count?.[0]?.count > 0;
  }).length;
  const totalUrls =
    STATIC_PATHS.length + TOPICS.length + browseCount + (worksCount || 0);
  const numSitemaps = Math.max(1, Math.ceil(totalUrls / MAX_URLS_PER_SITEMAP));

  return Array.from({ length: numSitemaps }, (_, i) => ({ id: String(i) }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const sitemapIndex = parseInt(await props.id);
  const supabase = createClient();

  // Fetch regulation types with counts (for /jelajahi/[type] pages)
  const { data: regTypes } = await supabase
    .from("regulation_types")
    .select("code, works(count)")
    .gt("works.count", 0);

  const staticPages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: STATIC_DATE,
    alternates: {
      languages: {
        id: `${BASE}${path}`,
        en: `${BASE}/en${path}`,
        "x-default": `${BASE}${path}`,
      },
    },
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1.0 : path === "/topik" ? 0.7 : path === "/connect" ? 0.6 : 0.5,
  }) as const);

  // Topic pages with language alternates
  const topicPages: MetadataRoute.Sitemap = TOPICS.map((topic) => ({
    url: `${BASE}/topik/${topic.slug}`,
    lastModified: STATIC_DATE,
    alternates: {
      languages: {
        id: `${BASE}/topik/${topic.slug}`,
        en: `${BASE}/en/topik/${topic.slug}`,
        "x-default": `${BASE}/topik/${topic.slug}`,
      },
    },
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Browse-by-type pages (/jelajahi/uu, /jelajahi/pp, etc.)
  const browsePages: MetadataRoute.Sitemap = (regTypes || [])
    .filter((rt) => {
      const count = rt.works as unknown as { count: number }[];
      return count?.[0]?.count > 0;
    })
    .map((rt) => {
      const typePath = `/jelajahi/${rt.code.toLowerCase()}`;
      return {
        url: `${BASE}${typePath}`,
        lastModified: STATIC_DATE,
        alternates: {
          languages: {
            id: `${BASE}${typePath}`,
            en: `${BASE}/en${typePath}`,
            "x-default": `${BASE}${typePath}`,
          },
        },
        changeFrequency: "weekly" as const,
        priority: 0.7,
      };
    });

  // Combine non-regulation URLs
  const nonRegulationUrls = [...staticPages, ...topicPages, ...browsePages];

  // Calculate which regulation URLs belong to this sitemap index
  const allNonRegCount = nonRegulationUrls.length;
  // First sitemap includes non-regulation URLs + as many regulation URLs as fit
  if (sitemapIndex === 0) {
    const regSlots = MAX_URLS_PER_SITEMAP - allNonRegCount;
    const works = await fetchRegulationPage(0, regSlots);
    return [...nonRegulationUrls, ...works];
  }

  // Subsequent sitemaps are regulation-only
  const regOffset = MAX_URLS_PER_SITEMAP - allNonRegCount + (sitemapIndex - 1) * MAX_URLS_PER_SITEMAP;
  const works = await fetchRegulationPage(regOffset, MAX_URLS_PER_SITEMAP);
  return works;
}

/** Fetch a page of regulation URLs for the sitemap. */
async function fetchRegulationPage(offset: number, limit: number): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient();
  const result: MetadataRoute.Sitemap = [];
  let fetched = 0;
  let dbOffset = offset;

  while (fetched < limit) {
    const batchSize = Math.min(SUPABASE_PAGE_SIZE, limit - fetched);
    const { data } = await supabase
      .from("works")
      .select("number, year, slug, updated_at, regulation_types(code)")
      .order("year", { ascending: false })
      .range(dbOffset, dbOffset + batchSize - 1);

    if (!data || data.length === 0) break;

    for (const work of data as unknown as WorkRow[]) {
      const typeCode = getRegTypeCode(work.regulation_types);
      if (!typeCode) continue;
      const type = typeCode.toLowerCase();
      const slug = workSlug(work, type);
      const path = `/peraturan/${type}/${slug}`;
      result.push({
        url: `${BASE}${path}`,
        lastModified: work.updated_at ? new Date(work.updated_at) : STATIC_DATE,
        alternates: {
          languages: {
            id: `${BASE}${path}`,
            en: `${BASE}/en${path}`,
            "x-default": `${BASE}${path}`,
          },
        },
        changeFrequency: "yearly" as const,
        priority: 0.9,
      });
      fetched++;
      if (fetched >= limit) break;
    }

    dbOffset += data.length;
    if (data.length < batchSize) break;
  }

  return result;
}
