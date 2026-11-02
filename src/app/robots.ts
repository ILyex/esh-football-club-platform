import type { MetadataRoute } from "next";

// Only the public website is indexable. The management dashboard, the field
// match console, the API surface and private document downloads are explicitly
// excluded — they were previously crawlable by URL and only protected by a
// redirect, which still lets crawlers discover and index the login wall.
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/ar/dashboard", "/fr/dashboard", "/ar/field", "/fr/field", "/ar/login", "/fr/login"]
      }
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base
  };
}
