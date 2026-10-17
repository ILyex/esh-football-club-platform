"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Trophy,
  Shield,
  Layers,
  Calendar,
  Sparkles,
  UsersRound,
  Plus
} from "lucide-react";
import type { TeamCategory, CompetitionType } from "@prisma/client";
import { OFFICIAL_CATEGORY_NAMES, type StandingTeamEntry, type CupBracketData } from "@/lib/competitions/types";
import { LeagueStandingsTable } from "./league-standings-table";
import { CupKnockoutBracket } from "./cup-knockout-bracket";
import { CompetitionLogoManager } from "./competition-logo-manager";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";
import { frenchCompetitionName } from "@/lib/public/locale-text";

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
  const competitionDisplayName = (name: string) => isAr ? name : frenchCompetitionName(name);
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
    : (seasons.some((season) => season.id === currentSeasonId)
      ? currentSeasonId
      : seasons[0]?.id || "");

  const [activeType, setActiveType] = useState<CompetitionType>(initialType);
  const [activeCategory, setActiveCategory] = useState<TeamCategory>(initialCategory);
  const [activeSeasonId, setActiveSeasonId] = useState<string>(initialSeason);
  const [isSwitching, startSwitchTransition] = useTransition();

  // Filter matched competition
  const currentComp = competitions.find(
    (c) =>
      c.type === activeType &&
      c.category === activeCategory &&
      c.seasonId === activeSeasonId
  );

  const handleTypeChange = (type: CompetitionType) => {
    if (type === activeType) return;
    setActiveType(type);
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", type);
    params.set("category", activeCategory);
    params.set("season", activeSeasonId);
    startSwitchTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
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
      <div className="flex flex-col gap-2.5 border-b border-border/70 pb-3 sm:gap-4 sm:pb-4 md:flex-row md:items-center md:justify-between">
        {/* Main Competition Switcher (League vs Algerian Cup) */}
        <div className={`inline-flex w-full items-center gap-1 rounded-xl border border-border/80 bg-muted/40 p-1 shadow-2xs transition-opacity sm:w-auto sm:rounded-2xl sm:p-1.5 ${isSwitching ? "opacity-70" : ""}`}>
          <button
            type="button"
            onClick={() => handleTypeChange("LEAGUE")}
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] outline-none transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40 sm:flex-none sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm font-bold ${
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
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] outline-none transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40 sm:flex-none sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm font-bold ${
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
        <div className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-end">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground whitespace-nowrap sm:text-xs">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-club-primary" />
            <span className="hidden sm:inline">{isAr ? "الموسم الرياضي:" : "Saison:"}</span>
          </div>

          <MasterFilterSelect
            locale={isAr ? "ar" : "fr"}
            label=""
            value={activeSeasonId}
            placeholder={isAr ? "اختر الموسم" : "Choisir la saison"}
            options={seasons.map((s) => ({
              id: s.id,
              label: `${s.label} ${s.isCurrent ? (isAr ? "(الحالي)" : "(Actuel)") : ""}`.trim()
            }))}
            onChange={handleSeasonChange}
            headerTitle={isAr ? "اختيار الموسم الرياضي" : "Choisir la saison"}
            size="sm"
            className="min-w-0 flex-1 sm:w-[220px] sm:flex-none [&>button]:w-full [&>button]:min-w-0 [&>button]:justify-between [&>button>span]:max-w-[min(9rem,45vw)] [&>button>span]:truncate sm:[&>button>span]:!max-w-none sm:[&>button>span]:!overflow-visible sm:[&>button>span]:!text-clip sm:[&>button>span]:whitespace-nowrap"
          />
        </div>
      </div>

      {/* CATEGORY SELECTOR TABS (Seamlessly switches between Senior, U20, U17, U15) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none sm:gap-2">
        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground sm:me-1 sm:text-xs">
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
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold transition-all shadow-2xs ${
                isActive
                  ? "border-club-primary bg-club-primary text-white shadow-xs"
                  : "border-border/80 bg-card text-muted-foreground hover:border-club-primary/50 hover:text-foreground"
              }`}
            >
              <UsersRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* COMPETITION BANNER (Logo + Name + Organization + Status) */}
      {currentComp ? (
        <div key={`banner-${activeType}-${activeCategory}-${activeSeasonId}`} className="relative animate-in fade-in slide-in-from-top-1 duration-200 overflow-hidden rounded-xl border border-border/80 bg-gradient-to-r from-card via-card to-muted/30 p-2.5 shadow-xs sm:rounded-2xl sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Competition Logo */}
              <div className="relative h-10 w-10 shrink-0 rounded-xl border border-border/80 bg-background p-1 flex items-center justify-center shadow-xs overflow-hidden sm:h-16 sm:w-16 sm:rounded-2xl sm:p-1.5">
                {currentComp.logoUrl ? (
                  <img
                    src={currentComp.logoUrl}
                    alt={competitionDisplayName(currentComp.name)}
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
                  <span className="rounded-md bg-club-primary/10 px-1.5 py-0.5 text-[9px] font-black text-club-primary sm:px-2 sm:text-[11px]">
                    {currentComp.seasonLabel}
                  </span>
                  {activeType === "CUP" && (
                    <span className="rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[11px] font-bold">
                      <span className="sm:hidden">{isAr ? "الكأس" : "Coupe"}</span>
                      <span className="hidden sm:inline">{isAr ? "كأس الجمهورية" : "Coupe Nationale"}</span>
                    </span>
                  )}
                </div>

                <h2 className="text-sm font-extrabold text-foreground truncate sm:text-xl">
                  {competitionDisplayName(currentComp.name)}
                </h2>

                {currentComp.organization && (
                  <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
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
                  competitionName={competitionDisplayName(currentComp.name)}
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
        <div key={`view-${activeType}-${activeCategory}-${activeSeasonId}`} className="mt-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
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

    </div>
  );
}
