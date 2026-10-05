import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Newspaper } from "lucide-react";
import { getPublicNewsList } from "@/lib/public/news";
import { NewsCard } from "@/components/public/news-card";

export default async function PublicNewsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; category?: string }>;
}) {
  const { locale } = await params;
  const { page: rawPage, category } = await searchParams;

  const page = Math.max(parseInt(rawPage || "1", 10) || 1, 1);

  const [tPublic, newsData] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicNewsList(locale, { page, pageSize: 9, category })
  ]);

  const { items, totalPages } = newsData;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      {/* Header */}
      <div className="border-b border-border/80 pb-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-club-primary">
          <Newspaper className="h-4 w-4" />
          {tPublic("news.title")}
        </span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
          {tPublic("news.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-2xl">
          {tPublic("news.subtitle")}
        </p>
      </div>

      {/* Articles Grid */}
      <div className="mt-8">
        {items.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((article) => (
              <NewsCard
                key={article.id}
                article={article}
                locale={locale}
                readMoreLabel={tPublic("news.readMore")}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
            <Newspaper className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              {tPublic("news.noArticles")}
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              const isActive = p === page;
              return (
                <Link
                  key={p}
                  href={`/${locale}/news?page=${p}${category ? `&category=${category}` : ""}`}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold transition-all ${
                    isActive
                      ? "bg-club-primary text-white shadow-xs"
                      : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
