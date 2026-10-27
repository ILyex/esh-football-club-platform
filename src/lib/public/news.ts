import "server-only";
import { db } from "@/lib/db";
import { frenchPublicText, hasArabicScript } from "./locale-text";
import { normalizePublicMediaUrl } from "@/lib/media-utils";

// ============================================================================
// PUBLIC NEWS & ARTICLES DATA ACCESS
// ----------------------------------------------------------------------------
// Strictly enforces publication rules: status === "PUBLISHED" and publishedAt <= now.
// Never exposes draft, scheduled, or archived articles.
// ============================================================================

export interface PublicNewsItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featuredImageUrl: string | null;
  category: string | null;
  publishedAt: Date;
  locale: string;
}

export interface PublicNewsArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  featuredImageUrl: string | null;
  imageUrls: string[];
  category: string | null;
  publishedAt: Date;
  locale: string;
  alternateLocaleSlug: string | null;
}

function safePublishedAt(value: Date | null | undefined, fallback: Date): Date {
  // Legacy records can contain malformed/zero dates that the database client
  // materializes as an Invalid Date. Keep one bad publication timestamp from
  // taking down the entire public homepage or news page during formatting.
  return value instanceof Date && Number.isFinite(value.getTime()) ? value : fallback;
}

/** Fetches paginated list of published news articles for the requested locale. */
export async function getPublicNewsList(
  locale: string,
  options?: { category?: string; page?: number; pageSize?: number }
): Promise<{ items: PublicNewsItem[]; totalCount: number; totalPages: number }> {
  const now = new Date();
  const page = Math.max(options?.page ?? 1, 1);
  const pageSize = options?.pageSize ?? 9;
  const skip = (page - 1) * pageSize;

  const where: any = {
    status: "PUBLISHED",
    // Older published records may predate publishedAt being populated.
    // They are still public because their authoritative state is PUBLISHED.
    OR: [{ publishedAt: { lte: now } }, { publishedAt: null }]
  };

  if (options?.category && options.category !== "all") {
    where.category = options.category;
  }

  const [articles, totalCount] = await Promise.all([
    db.news.findMany({
      where,
      select: {
        id: true,
        featuredImageUrl: true,
        category: true,
        publishedAt: true,
        translations: {
          select: {
            locale: true,
            title: true,
            slug: true,
            content: true
          }
        }
      },
      orderBy: { publishedAt: "desc" },
      skip,
      take: pageSize
    }),
    db.news.count({ where })
  ]);

  const items: PublicNewsItem[] = articles.flatMap((article) => {
    // Reject Arabic content only on the French public site. Arabic is the
    // expected language for the Arabic route and must remain visible there.
    const translation = article.translations.find((t) => t.locale === locale);
    if (!translation || (locale === "fr" && (hasArabicScript(translation.title) || hasArabicScript(translation.content)))) return [];

    const title = translation.title;
    const slug = translation.slug || article.id;
    // Extract first 160 characters as excerpt
    const plainText = (translation.content || "").replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
    const excerpt = plainText.length > 160 ? `${plainText.slice(0, 160)}...` : plainText;

    return [{
      id: article.id,
      slug,
      title,
      excerpt,
      featuredImageUrl: normalizePublicMediaUrl(article.featuredImageUrl),
      category: locale === "ar" ? article.category : frenchPublicText(article.category, "Club"),
      publishedAt: safePublishedAt(article.publishedAt, now),
      locale: translation.locale
    }];
  });

  return {
    items,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize)
  };
}

/** Fetches a single public news article by slug for the requested locale. */
export async function getPublicNewsArticle(slug: string, locale: string): Promise<PublicNewsArticle | null> {
  const now = new Date();
  let lookupSlug = slug;
  try {
    lookupSlug = decodeURIComponent(slug);
  } catch {
    // Next normally provides a decoded segment; keep the original on malformed input.
  }

  // Resolve both normal slugs and the id fallback used for older translations.
  const translation = await db.newsTranslation.findFirst({
    where: {
      locale,
      // Some older records have no translation slug. The list endpoint uses
      // the news id as a stable fallback, so details must resolve that value too.
      OR: [{ slug: lookupSlug }, { news: { id: lookupSlug } }],
      news: {
        status: "PUBLISHED",
        OR: [{ publishedAt: { lte: now } }, { publishedAt: null }]
      }
    },
    include: {
      news: {
        include: {
          translations: {
            select: {
              locale: true,
              slug: true
            }
          }
        }
      }
    }
  });

  if (!translation) return null;
  if (locale === "fr" && (hasArabicScript(translation.title) || hasArabicScript(translation.content))) return null;

  const otherLocale = locale === "ar" ? "fr" : "ar";
  const alternateTrans = translation.news.translations.find((t) => t.locale === otherLocale);

  return {
    id: translation.news.id,
    slug: translation.slug,
    title: translation.title,
    content: translation.content,
    featuredImageUrl: normalizePublicMediaUrl(translation.news.featuredImageUrl),
    imageUrls: (translation.news.imageUrls || []).map((url) => normalizePublicMediaUrl(url)).filter((url): url is string => Boolean(url)),
    category: locale === "ar" ? translation.news.category : frenchPublicText(translation.news.category, "Club"),
    publishedAt: safePublishedAt(translation.news.publishedAt, now),
    locale: translation.locale,
    alternateLocaleSlug: alternateTrans?.slug ?? null
  };
}
