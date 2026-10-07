import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Search as SearchIcon, ArrowRight, ArrowLeft, ListFilter } from "lucide-react";
import { executeGlobalSearch } from "@/lib/search/search-service";

export default async function GlobalSearchPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { locale } = await params;
  const { q, category } = await searchParams;
  const isRtl = locale === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const t = await getTranslations("search");

  const query = (q || "").trim();

  const searchResponse = query
    ? await executeGlobalSearch(query, { locale, filterCategory: category, limitPerCategory: 10 })
    : { query: "", totalResults: 0, groups: [] };

  const { groups, totalResults } = searchResponse;

  return (
    <div className="space-y-6">
      {/* Search Header & Input */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-xs">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-club-primary/10 px-2 text-lg font-black tabular-nums text-club-primary">
              {totalResults}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {query ? (isRtl ? "نتائج مطابقة" : "résultats correspondants") : t("noQuery")}
            </span>
          </div>
          {query && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
              <ListFilter className="h-3.5 w-3.5" />
              {t("allCategories")}
            </span>
          )}
        </div>
      </div>

      {/* Category Pills Filter */}
      {query.length >= 2 && groups.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/80 pb-4 text-xs">
          <Link
            href={`/${locale}/dashboard/search?q=${encodeURIComponent(query)}`}
            className={`rounded-full px-3 py-1 font-semibold transition-all ${
              !category
                ? "bg-foreground text-background"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("allCategories")} ({totalResults})
          </Link>
          {groups.map((g) => {
            const isSelected = category === g.key;
            return (
              <Link
                key={g.key}
                href={`/${locale}/dashboard/search?q=${encodeURIComponent(query)}&category=${g.key}`}
                className={`rounded-full px-3 py-1 font-semibold transition-all ${
                  isSelected
                    ? "bg-foreground text-background"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`categories.${g.key}` as any)} ({g.count})
              </Link>
            );
          })}
        </div>
      )}

      {/* Results Section */}
      {query.length < 2 ? (
        <div className="flex h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          <SearchIcon className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p>{t("noQuery")}</p>
        </div>
      ) : totalResults === 0 ? (
        <div className="flex h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          <SearchIcon className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p>{t("noResults")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-xs">
                <h2 className="font-bold text-foreground">
                  {t(`categories.${group.key}` as any)}
                </h2>
                <span className="text-muted-foreground font-semibold">
                  {group.count}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <Link
                    key={`${group.key}-${item.id}`}
                    href={item.href}
                    className="group flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 shadow-xs transition-all hover:border-club-primary/50 hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-foreground transition-colors group-hover:text-club-primary truncate">
                          {item.title}
                        </h3>
                        {item.badge && (
                          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="mt-1 text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-end text-[11px] font-medium text-club-primary">
                      <Arrow className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
