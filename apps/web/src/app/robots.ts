import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/search",
          "/en/search",
          "/peraturan/*/koreksi/",
          "/en/peraturan/*/koreksi/",
          "/api/v1/",
          "/api/suggestions",
          "/api/laws/",
          "/api/og",
          "/api/admin/",
        ],
      },
    ],
    // generateSitemaps() creates individual sitemaps at /sitemap/{id}.xml.
    // List them here since Next.js 16 doesn't auto-generate a sitemap index.
    // Crawlers ignore 404s, so a generous upper bound is safe.
    sitemap: Array.from({ length: 20 }, (_, i) => `https://pasal.id/sitemap/${i}.xml`),
  };
}
