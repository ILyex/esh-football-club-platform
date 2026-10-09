import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, Newspaper } from "lucide-react";
import { getPublicNewsList } from "@/lib/public/news";
import { NewsCard } from "@/components/public/news-card";
import { PublicPageHeading } from "@/components/public/public-page-heading";

// News is managed from the dashboard and must reflect publication changes immediately.
export const dynamic = "force-dynamic";

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
    getPublicNewsList(locale, { page, pageSize: 8, category })
  ]);

  const { items, totalPages } = newsData;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PublicPageHeading locale={locale} icon={<Newspaper />} eyebrow={tPublic("news.title")} title={tPublic("news.title")} description={tPublic("news.subtitle")} />

      {/* Articles Grid */}
      <div className="mt-8">
        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
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
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 border-t border-border/70 pt-6">
            <Link
              href={`/${locale}/news?page=${Math.max(1, page - 1)}${category ? `&category=${category}` : ""}`}
              aria-disabled={page === 1}
              className={`inline-flex h-10 items-center gap-1 rounded-lg border px-3 text-xs font-bold transition-colors ${page === 1 ? "pointer-events-none border-border/50 text-muted-foreground/40" : "border-border bg-card text-foreground hover:border-club-primary/50 hover:text-club-primary"}`}
            >
              {locale === "ar" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              <span className="hidden sm:inline">{locale === "ar" ? "السابق" : "Précédent"}</span>
            </Link>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              const isActive = p === page;
              return (
                <Link
                  key={p}
                  href={`/${locale}/news?page=${p}${category ? `&category=${category}` : ""}`}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-club-primary text-white shadow-xs"
                      : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
            <Link
              href={`/${locale}/news?page=${Math.min(totalPages, page + 1)}${category ? `&category=${category}` : ""}`}
              aria-disabled={page === totalPages}
              className={`inline-flex h-10 items-center gap-1 rounded-lg border px-3 text-xs font-bold transition-colors ${page === totalPages ? "pointer-events-none border-border/50 text-muted-foreground/40" : "border-border bg-card text-foreground hover:border-club-primary/50 hover:text-club-primary"}`}
            >
              <span className="hidden sm:inline">{locale === "ar" ? "التالي" : "Suivant"}</span>
              {locale === "ar" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
