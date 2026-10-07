import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Trophy, Calendar } from "lucide-react";
import { TeamCategory } from "@prisma/client";
import { getPublicMatches } from "@/lib/public/matches";
import { getPublicTeams } from "@/lib/public/teams";
import { MatchCard } from "@/components/public/match-card";
import { frenchPublicCategory } from "@/lib/public/locale-text";
import { LiveMatchRefresh } from "@/components/public/live-match-refresh";

export default async function PublicMatchesPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; category?: string }>;
}) {
  const { locale } = await params;
  const { tab = "UPCOMING", category } = await searchParams;

  const activeTab = tab === "RESULTS" ? "RESULTS" : tab === "ALL" ? "ALL" : "UPCOMING";
  const validCategory = category && Object.values(TeamCategory).includes(category.toUpperCase() as TeamCategory)
    ? (category.toUpperCase() as TeamCategory)
    : undefined;

  const [tPublic, matches, teams] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicMatches({
      mode: activeTab,
      teamCategory: validCategory,
      limit: 50
    }),
    getPublicTeams()
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
      {/* Header */}
      <div className="border-b border-border/80 pb-6">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-club-primary">
          <Trophy className="h-4 w-4" />
          {tPublic("matches.title")}
        </span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
          {tPublic("matches.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-2xl">
          {tPublic("matches.subtitle")}
        </p>

        {/* Tab Filters: Upcoming vs Results vs All */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link
            href={`/${locale}/matches?tab=UPCOMING${category ? `&category=${category}` : ""}`}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "UPCOMING"
                ? "bg-club-primary text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {tPublic("matches.upcoming")}
          </Link>
          <Link
            href={`/${locale}/matches?tab=RESULTS${category ? `&category=${category}` : ""}`}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "RESULTS"
                ? "bg-club-primary text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {tPublic("matches.completed")}
          </Link>
          <Link
            href={`/${locale}/matches?tab=ALL${category ? `&category=${category}` : ""}`}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "ALL"
                ? "bg-club-primary text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {tPublic("matches.all")}
          </Link>
        </div>

        {/* Category Pills Filter */}
        {teams.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-muted-foreground me-2">
              {tPublic("teams.selectCategory")}:
            </span>
            <Link
              href={`/${locale}/matches?tab=${activeTab}`}
              className={`rounded-full px-3 py-1 font-medium transition-all ${
                !validCategory
                  ? "bg-foreground text-background"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {tPublic("matches.all")}
            </Link>
            {teams.map((t) => {
              const isSelected = validCategory === t.category;
              return (
                <Link
                  key={t.id}
                  href={`/${locale}/matches?tab=${activeTab}&category=${t.category.toLowerCase()}`}
                  className={`rounded-full px-3 py-1 font-medium transition-all ${
                    isSelected
                      ? "bg-foreground text-background"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {locale === "ar" ? t.name : frenchPublicCategory(t.category)}
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
