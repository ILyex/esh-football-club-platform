import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Trophy, Calendar, CheckCircle2, ListChecks, UsersRound } from "lucide-react";
import { TeamCategory } from "@prisma/client";
import { getPublicMatches } from "@/lib/public/matches";
import { getPublicTeams } from "@/lib/public/teams";
import { MatchCard } from "@/components/public/match-card";
import { frenchPublicCategory } from "@/lib/public/locale-text";
import { LiveMatchRefresh } from "@/components/public/live-match-refresh";
import { PublicPageHeading } from "@/components/public/public-page-heading";
import { getPublicClubSettings } from "@/lib/public/club";

export default async function PublicMatchesPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; category?: string }>;
}) {
  const { locale } = await params;
  // Show the full fixture history by default so finished games are not hidden
  // behind the upcoming-only filter when visitors open the matches page.
  const { tab = "ALL", category } = await searchParams;

  const activeTab = tab === "RESULTS" ? "RESULTS" : tab === "UPCOMING" ? "UPCOMING" : "ALL";
  const validCategory = category && Object.values(TeamCategory).includes(category.toUpperCase() as TeamCategory)
    ? (category.toUpperCase() as TeamCategory)
    : undefined;

  const [tPublic, matches, teams, club] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicMatches({
      mode: activeTab,
      teamCategory: validCategory,
      limit: 50
    }),
    getPublicTeams(),
    getPublicClubSettings()
  ]);

  const matchCardLabels = {
    scheduled: tPublic("matchStatus.SCHEDULED"),
    live: tPublic("matchStatus.LIVE"),
    finished: tPublic("matchStatus.FINISHED"),
    postponed: tPublic("matchStatus.POSTPONED"),
    cancelled: tPublic("matchStatus.CANCELLED"),
    details: tPublic("matches.matchCenter"),
    home: locale === "ar" ? "المستضيف" : "Domicile",
    away: locale === "ar" ? "الضيف" : "Extérieur"
  };
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <LiveMatchRefresh enabled={matches.some((match) => match.status === "LIVE")} />
      <PublicPageHeading locale={locale} icon={<Trophy />} eyebrow={tPublic("matches.title")} title={tPublic("matches.title")} description={tPublic("matches.subtitle")} />
      <div className="border-b border-border/80 pb-6">
        {/* Tab Filters: Upcoming vs Results vs All */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link
            href={`/${locale}/matches?tab=UPCOMING${category ? `&category=${category}` : ""}`}
            className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "UPCOMING"
                ? "bg-club-primary text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            <Calendar className="me-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {tPublic("matches.upcoming")}
          </Link>
          <Link
            href={`/${locale}/matches?tab=RESULTS${category ? `&category=${category}` : ""}`}
            className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "RESULTS"
                ? "bg-club-primary text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="me-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {tPublic("matches.completed")}
          </Link>
          <Link
            href={`/${locale}/matches?tab=ALL${category ? `&category=${category}` : ""}`}
            className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "ALL"
                ? "bg-club-primary text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            <ListChecks className="me-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {tPublic("matches.all")}
          </Link>
        </div>

        {/* Category Pills Filter */}
        {teams.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs sm:gap-2">
            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
              {locale === "ar" ? "الفئة:" : "Catégorie :"}
            </span>
            <Link
              href={`/${locale}/matches?tab=${activeTab}`}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold transition-all ${
                !validCategory
                  ? "border-club-primary bg-club-primary text-white shadow-xs"
                  : "border-border/80 bg-card text-muted-foreground hover:border-club-primary/50 hover:text-foreground"
              }`}
            >
              <UsersRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {tPublic("matches.all")}
            </Link>
            {teams.map((t) => {
              const isSelected = validCategory === t.category;
              const categoryLabel = locale === "ar"
                ? ({ SENIOR: "الأكابر", U20: "U20", U17: "U17", U15: "U15" } as Record<string, string>)[t.category] ?? t.category
                : frenchPublicCategory(t.category);
              return (
                <Link
                  key={t.id}
                  href={`/${locale}/matches?tab=${activeTab}&category=${t.category.toLowerCase()}`}
                  className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold transition-all ${
                    isSelected
                      ? "border-club-primary bg-club-primary text-white shadow-xs"
                      : "border-border/80 bg-card text-muted-foreground hover:border-club-primary/50 hover:text-foreground"
                  }`}
                >
                  <UsersRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {categoryLabel}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Matches Grid */}
      <div className="mt-8">
        {matches.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                locale={locale}
                clubLogoUrl={club.logoUrl}
                labels={matchCardLabels}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              {tPublic("matches.noMatches")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
