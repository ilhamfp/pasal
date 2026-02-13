import type { MetadataRoute } from "next";
import { TOPICS } from "@/data/topics";
import { getRegTypeCode } from "@/lib/get-reg-type-code";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  // Fetch all works with their regulation type codes
  const { data: works } = await supabase
    .from("works")
    .select("number, year, regulation_types(code)")
    .order("year", { ascending: false });

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: "https://pasal.id", changeFrequency: "weekly", priority: 1.0 },
    { url: "https://pasal.id/search", changeFrequency: "weekly", priority: 0.8 },
    { url: "https://pasal.id/connect", changeFrequency: "monthly", priority: 0.6 },
    { url: "https://pasal.id/api", changeFrequency: "monthly", priority: 0.5 },
    { url: "https://pasal.id/topik", changeFrequency: "monthly", priority: 0.7 },
  ];

  // Topic pages
  const topicPages: MetadataRoute.Sitemap = TOPICS.map((topic) => ({
    url: `https://pasal.id/topik/${topic.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Regulation detail pages
  const regulationPages: MetadataRoute.Sitemap = (works || [])
    .filter((work) => getRegTypeCode(work.regulation_types))
    .map((work) => {
      const type = getRegTypeCode(work.regulation_types).toLowerCase();
      const slug = `${type}-${work.number}-${work.year}`;
      return {
        url: `https://pasal.id/peraturan/${type}/${slug}`,
        changeFrequency: "yearly" as const,
        priority: 0.9,
      };
    });

  return [...staticPages, ...topicPages, ...regulationPages];
}
