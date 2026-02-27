import type { MetadataRoute } from "next";
import { TOPICS } from "@/data/topics";
import { getRegTypeCode } from "@/lib/get-reg-type-code";
import { workSlug } from "@/lib/work-url";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const now = new Date();
  // Fixed date for static/topic/browse pages — only update when content actually changes
  const staticDate = new Date("2026-02-28");

  // Fetch all works with their regulation type codes and updated_at
  const { data: works } = await supabase
    .from("works")
    .select("number, year, slug, updated_at, regulation_types(code)")
    .order("year", { ascending: false });

  // Fetch regulation types that have at least one work (for /jelajahi/[type] pages)
  const { data: regTypes } = await supabase
    .from("regulation_types")
    .select("code, works(count)")
    .gt("works.count", 0);

  const BASE = "https://pasal.id";

  // Static pages with language alternates (no /search — it has noindex)
  const STATIC_PATHS = ["", "/jelajahi", "/connect", "/api", "/topik"];
  const staticPages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: staticDate,
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
    lastModified: staticDate,
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
        lastModified: staticDate,
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

  // Regulation detail pages with language alternates
  const regulationPages: MetadataRoute.Sitemap = (works || [])
    .filter((work) => getRegTypeCode(work.regulation_types))
    .map((work) => {
      const type = getRegTypeCode(work.regulation_types).toLowerCase();
      const slug = workSlug(work, type);
      const path = `/peraturan/${type}/${slug}`;
      return {
        url: `${BASE}${path}`,
        lastModified: work.updated_at ? new Date(work.updated_at) : now,
        alternates: {
          languages: {
            id: `${BASE}${path}`,
            en: `${BASE}/en${path}`,
            "x-default": `${BASE}${path}`,
          },
        },
        changeFrequency: "yearly" as const,
        priority: 0.9,
      };
    });

  return [...staticPages, ...topicPages, ...browsePages, ...regulationPages];
}
