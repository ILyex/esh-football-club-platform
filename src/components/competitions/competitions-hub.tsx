"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Trophy,
  Shield,
  Layers,
  Calendar,
  Sparkles,
  Plus
} from "lucide-react";
import type { TeamCategory, CompetitionType } from "@prisma/client";
import { OFFICIAL_CATEGORY_NAMES, type StandingTeamEntry, type CupBracketData } from "@/lib/competitions/types";
import { LeagueStandingsTable } from "./league-standings-table";
import { CupKnockoutBracket } from "./cup-knockout-bracket";
import { CompetitionLogoManager } from "./competition-logo-manager";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";

export interface CompetitionHubData {
  id: string;
  name: string;
  type: CompetitionType;
  logoUrl?: string | null;
  organization?: string | null;
  seasonId: string;
  seasonLabel: string;
  category: TeamCategory;
  categoryLabelAr: string;
  categoryLabelFr: string;
  status: string;
  standings: StandingTeamEntry[];
  bracket: CupBracketData;
  matches: {
    id: string;
    matchDate: Date | string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
  }[];
  hasUnverifiedTemplateData?: boolean;
}

interface CompetitionsHubProps {
  competitions: CompetitionHubData[];
  seasons: { id: string; label: string; isCurrent: boolean }[];
  currentSeasonId: string;
  locale: string;
  canManage?: boolean;
  clubName?: string;
  isPublic?: boolean;
}

export function CompetitionsHub({
  competitions,
  seasons,
  currentSeasonId,
  locale,
  canManage = false,
  clubName = "أمل سيدي حسني (ESH)",
  isPublic = false
}: CompetitionsHubProps) {
  const isAr = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();

  const categories: TeamCategory[] = ["SENIOR", "U20", "U17", "U15"];
  const initialType: CompetitionType = searchParams.get("type") === "CUP" ? "CUP" : "LEAGUE";
  const requestedCategory = searchParams.get("category");
  const initialCategory: TeamCategory = categories.includes(requestedCategory as TeamCategory)
    ? requestedCategory as TeamCategory
    : "SENIOR";
  const requestedSeason = searchParams.get("season");
  const initialSeason = seasons.some((season) => season.id === requestedSeason)
    ? requestedSeason!
    : currentSeasonId || seasons[0]?.id || "";

  const [activeType, setActiveType] = useState<CompetitionType>(initialType);
  const [activeCategory, setActiveCategory] = useState<TeamCategory>(initialCategory);
  const [activeSeasonId, setActiveSeasonId] = useState<string>(initialSeason);

  // Filter matched competition
  const currentComp = competitions.find(
    (c) =>
      c.type === activeType &&
      c.category === activeCategory &&
      c.seasonId === activeSeasonId
  );

  const orderedMatches = [...(currentComp?.matches ?? [])].sort((a, b) => {
    const dateA = new Date(a.matchDate).getTime();
    const dateB = new Date(b.matchDate).getTime();
    const now = Date.now();
    const aUpcoming = dateA >= now;
    const bUpcoming = dateB >= now;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return aUpcoming ? dateA - dateB : dateB - dateA;
  });

  const handleTypeChange = (type: CompetitionType) => {
    setActiveType(type);
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", type);
    params.set("category", activeCategory);
    params.set("season", activeSeasonId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleCategoryChange = (cat: TeamCategory) => {
    setActiveCategory(cat);
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", activeType);
    params.set("category", cat);
    params.set("season", activeSeasonId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleSeasonChange = (seasonId: string) => {
    setActiveSeasonId(seasonId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", activeType);
    params.set("category", activeCategory);
    params.set("season", seasonId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER CONTROLS: Competition Type Tabs & Season Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/70 pb-4">
        {/* Main Competition Switcher (League vs Algerian Cup) */}
        <div className="inline-flex rounded-2xl border border-border/80 bg-muted/40 p-1.5 shadow-2xs">
          <button
            type="button"
            onClick={() => handleTypeChange("LEAGUE")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
              activeType === "LEAGUE"
                ? "bg-card text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <Layers className="h-4 w-4 text-club-primary" />
            <span>{isAr ? "الدوري" : "Championnat"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange("CUP")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
              activeType === "CUP"
                ? "bg-card text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <Trophy className="h-4 w-4 text-amber-500" />
            <span>{isAr ? "كأس الجزائر" : "Coupe d'Algérie"}</span>
          </button>
        </div>

        {/* Season Selector Dropdown */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-club-primary" />
            <span>{isAr ? "الموسم الرياضي:" : "Saison:"}</span>
          </div>

          <MasterFilterSelect
            locale={isAr ? "ar" : "fr"}
            label=""
            value={activeSeasonId}
            options={seasons.map((s) => ({
              id: s.id,
              label: `${s.label} ${s.isCurrent ? (isAr ? "(الحالي)" : "(Actuel)") : ""}`.trim()
            }))}
            onChange={handleSeasonChange}
            headerTitle={isAr ? "اختيار الموسم الرياضي" : "Choisir la saison"}
            icon={Calendar}
            size="sm"
          />
        </div>
      </div>

      {/* CATEGORY SELECTOR TABS (Seamlessly switches between Senior, U20, U17, U15) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-semibold text-muted-foreground shrink-0 me-1">
          {isAr ? "الفئة:" : "Catégorie:"}
        </span>
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          const label = isAr ? OFFICIAL_CATEGORY_NAMES[cat].ar : OFFICIAL_CATEGORY_NAMES[cat].fr;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all shadow-2xs ${
                isActive
                  ? "bg-club-primary text-white shadow-xs ring-2 ring-club-primary/30"
                  : "border border-border/80 bg-card text-muted-foreground hover:border-club-primary/50 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* COMPETITION BANNER (Logo + Name + Organization + Status) */}
      {currentComp ? (
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-muted/30 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Competition Logo */}
              <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl border border-border/80 bg-background p-1.5 flex items-center justify-center shadow-xs overflow-hidden">
                {currentComp.logoUrl ? (
                  <img
                    src={currentComp.logoUrl}
                    alt={currentComp.name}
                    className="h-full w-full object-contain"
                  />
                ) : activeType === "CUP" ? (
                  <Trophy className="h-8 w-8 text-amber-500" />
                ) : (
                  <Shield className="h-8 w-8 text-club-primary" />
                )}
              </div>

              {/* Title & Info */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="rounded-md bg-club-primary/10 px-2 py-0.5 text-[11px] font-black text-club-primary">
                    {currentComp.seasonLabel}
                  </span>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold text-foreground">
                    {isAr ? currentComp.categoryLabelAr : currentComp.categoryLabelFr}
                  </span>
                  {activeType === "CUP" && (
                    <span className="rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[11px] font-bold">
                      {isAr ? "كأس الجمهورية" : "Coupe Nationale"}
                    </span>
                  )}
                </div>

                <h2 className="text-lg sm:text-xl font-extrabold text-foreground truncate">
                  {currentComp.name}
                </h2>

                {currentComp.organization && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentComp.organization}
                  </p>
                )}
              </div>
            </div>

            {/* Admin Logo Manager */}
            {!isPublic && canManage && (
              <div className="shrink-0 flex items-center gap-2">
                <CompetitionLogoManager
                  competitionId={currentComp.id}
                  currentLogoUrl={currentComp.logoUrl}
                  competitionName={currentComp.name}
                  locale={locale}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-sm text-muted-foreground rounded-2xl border border-border bg-card">
          {isAr ? "لا توجد مسابقة مسجلة لهذه الفئة في هذا الموسم" : "Aucune compétition enregistrée pour cette catégorie"}
        </div>
      )}

      {/* ACTIVE VIEW CONTENT */}
      {currentComp && (
        <div className="mt-4">
          {activeType === "LEAGUE" ? (
            currentComp.standings.length > 0 || !isPublic ? (
              <LeagueStandingsTable
                competitionId={currentComp.id}
                standings={currentComp.standings || []}
                locale={locale}
                canManage={canManage}
                clubName={clubName}
                isPublic={isPublic}
              />
            ) : null
          ) : (
            currentComp.bracket.rounds.length > 0 || !isPublic ? (
              <CupKnockoutBracket
                competitionId={currentComp.id}
                bracket={currentComp.bracket || { rounds: [] }}
                locale={locale}
                canManage={canManage}
                clubName={clubName}
                isPublic={isPublic}
              />
            ) : null
          )}
        </div>
      )}

      {currentComp?.hasUnverifiedTemplateData && !isPublic && canManage && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
          {isAr
            ? "أُخفيت بيانات نموذج تجريبي قديم من العرض لأنها ليست نتائج موثقة. لم تُحذف من التخزين؛ أدخل الترتيب أو المباريات الرسمية بعد التحقق من سجلات الرابطة."
            : "Un ancien modèle de démonstration a été masqué car ses résultats ne sont pas vérifiés. Les données restent stockées ; saisissez les résultats officiels après vérification."}
        </div>
      )}

      {currentComp && orderedMatches.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-club-primary" />
              <h3 className="text-sm font-bold">{isAr ? "مباريات هذه المسابقة" : "Matchs de cette compétition"}</h3>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
              {orderedMatches.length} {isAr ? "مباراة" : "matchs"}
            </span>
          </div>
          <div className="space-y-2">
            {orderedMatches.map((match) => (
              <Link
                key={match.id}
                href={isPublic ? `/${locale}/matches/${match.id}` : `/${locale}/dashboard/matches/${match.id}`}
                dir={isAr ? "rtl" : "ltr"}
                className="block rounded-xl border border-border/70 bg-background/60 px-3 py-3 transition-colors hover:border-club-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/50 sm:px-4"
              >
                <div className="mb-3 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <time dateTime={new Date(match.matchDate).toISOString()}>
                    {new Intl.DateTimeFormat(isAr ? "ar-DZ" : "fr-FR", { dateStyle: "medium", timeZone: "Africa/Algiers" }).format(new Date(match.matchDate))}
                  </time>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${match.status === "LIVE" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground"}`}>
                    {match.status === "LIVE" ? (isAr ? "مباشرة" : "En direct")
                      : match.status === "FINISHED" ? (isAr ? "انتهت" : "Terminée")
                      : match.status === "POSTPONED" ? (isAr ? "مؤجلة" : "Reportée")
                      : match.status === "CANCELLED" ? (isAr ? "ملغاة" : "Annulée")
                      : (isAr ? "مجدولة" : "Programmée")}
                  </span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                  <span className="truncate text-start text-xs font-semibold text-foreground sm:text-sm">{match.homeTeamName}</span>
                  <span className="min-w-12 rounded-lg bg-muted px-2.5 py-1.5 text-center font-mono text-xs font-bold tabular-nums text-foreground">
                    {match.homeScore == null || match.awayScore == null ? "–" : `${match.homeScore} : ${match.awayScore}`}
                  </span>
                  <span className="truncate text-end text-xs font-semibold text-foreground sm:text-sm">{match.awayTeamName}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
