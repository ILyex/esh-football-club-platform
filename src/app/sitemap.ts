import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

// The public site is the discoverable half of this platform and previously had
// NO sitemap at all. This one lists the static public routes for both locales
// plus every published news article and each team category.
//
// Rendered on demand (not at build time) because the deployment builds without
// a reachable database. A failure to read the database degrades to the static
// routes instead of breaking the build or returning 500.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

const STATIC_PATHS = [
  "",
  "/news",
  "/club",
  "/gallery",
  "/team/senior",
  "/team/u20",
  "/team/u17"
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();

  const localized = (path: string) =>
    ["ar", "fr"].flatMap((locale) => [
      {
        url: `${base}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === "" ? ("daily" as const) : ("weekly" as const),
        priority: path === "" ? 1 : 0.7,
        alternates: { languages: { ar: `${base}/ar${path}`, fr: `${base}/fr${path}` } }
      }
    ]);

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.flatMap(localized);

  try {
    // Slug lives on the per-locale translation row (News.slug does not exist),
    // and each locale has its own slug — so both are emitted explicitly.
    const news = await db.news.findMany({
      where: { status: "PUBLISHED" },
      select: { updatedAt: true, translations: { select: { locale: true, slug: true } } },
      orderBy: { publishedAt: "desc" },
      take: 500
    });
    for (const article of news) {
      const slugsByLocale = new Map(article.translations.map((translation) => [translation.locale, translation.slug]));
      for (const locale of ["ar", "fr"]) {
        const slug = slugsByLocale.get(locale);
        if (!slug) continue;
        const otherLocale = locale === "ar" ? "fr" : "ar";
        const otherSlug = slugsByLocale.get(otherLocale);
        entries.push({
          url: `${base}/${locale}/news/${encodeURIComponent(slug)}`,
          lastModified: article.updatedAt,
          changeFrequency: "monthly",
          priority: 0.6,
          alternates: {
            languages: {
              [locale]: `${base}/${locale}/news/${encodeURIComponent(slug)}`,
              ...(otherSlug ? { [otherLocale]: `${base}/${otherLocale}/news/${encodeURIComponent(otherSlug)}` } : {})
            }
          }
        });
      }
    }
  } catch {
    // A sitemap is not worth a 500: fall back to the static route list.
  }

  return entries;
}
