import "server-only";
import { db } from "@/lib/db";

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
    publishedAt: { lte: now }
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

  const items: PublicNewsItem[] = articles.map((article) => {
    // Pick requested locale translation or fallback to first available
    const translation =
      article.translations.find((t) => t.locale === locale) ||
      article.translations.find((t) => t.locale === "ar") ||
      article.translations[0];

    const title = translation?.title || "خبر بدون عنوان";
    const slug = translation?.slug || article.id;
    // Extract first 160 characters as excerpt
    const plainText = (translation?.content || "").replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
    const excerpt = plainText.length > 160 ? `${plainText.slice(0, 160)}...` : plainText;

    return {
      id: article.id,
      slug,
      title,
      excerpt,
      featuredImageUrl: article.featuredImageUrl,
      category: article.category,
      publishedAt: article.publishedAt || now,
      locale: translation?.locale || locale
    };
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

  // Find translation with matching slug
  const translation = await db.newsTranslation.findFirst({
    where: {
      slug,
      news: {
        status: "PUBLISHED",
        publishedAt: { lte: now }
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

  const otherLocale = locale === "ar" ? "fr" : "ar";
  const alternateTrans = translation.news.translations.find((t) => t.locale === otherLocale);

  return {
    id: translation.news.id,
    slug: translation.slug,
    title: translation.title,
    content: translation.content,
    featuredImageUrl: translation.news.featuredImageUrl,
    imageUrls: translation.news.imageUrls || [],
    category: translation.news.category,
    publishedAt: translation.news.publishedAt || now,
    locale: translation.locale,
    alternateLocaleSlug: alternateTrans?.slug ?? null
  };
}
