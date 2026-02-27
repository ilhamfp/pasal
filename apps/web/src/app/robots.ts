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
    sitemap: "https://pasal.id/sitemap.xml",
  };
}
