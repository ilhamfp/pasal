import type { MetadataRoute } from "next";
import { TOPICS } from "@/data/topics";
import { getRegTypeCode } from "@/lib/get-reg-type-code";
import { workSlug } from "@/lib/work-url";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  // Fetch all works with their regulation type codes
  const { data: works } = await supabase
    .from("works")
    .select("number, year, slug, regulation_types(code)")
    .order("year", { ascending: false });

  const BASE = "https://pasal.id";

  // Static pages with language alternates
  const STATIC_PATHS = ["", "/search", "/jelajahi", "/connect", "/api", "/topik"];
  const staticPages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${BASE}${path}`,
    alternates: {
      languages: {
        id: `${BASE}${path}`,
        en: `${BASE}/en${path}`,
      },
    },
    changeFrequency: path === "" ? "weekly" : path === "/search" ? "weekly" : "monthly",
    priority: path === "" ? 1.0 : path === "/search" ? 0.8 : path === "/topik" ? 0.7 : path === "/connect" ? 0.6 : 0.5,
  }) as const);

  // Topic pages with language alternates
  const topicPages: MetadataRoute.Sitemap = TOPICS.map((topic) => ({
    url: `${BASE}/topik/${topic.slug}`,
    alternates: {
      languages: {
        id: `${BASE}/topik/${topic.slug}`,
        en: `${BASE}/en/topik/${topic.slug}`,
      },
    },
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Regulation detail pages with language alternates
  const regulationPages: MetadataRoute.Sitemap = (works || [])
    .filter((work) => getRegTypeCode(work.regulation_types))
    .map((work) => {
      const type = getRegTypeCode(work.regulation_types).toLowerCase();
      const slug = workSlug(work, type);
      const path = `/peraturan/${type}/${slug}`;
      return {
        url: `${BASE}${path}`,
        alternates: {
          languages: {
            id: `${BASE}${path}`,
            en: `${BASE}/en${path}`,
          },
        },
        changeFrequency: "yearly" as const,
        priority: 0.9,
      };
    });

  return [...staticPages, ...topicPages, ...regulationPages];
}
