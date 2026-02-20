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
        ],
      },
    ],
    sitemap: "https://pasal.id/sitemap.xml",
  };
}
