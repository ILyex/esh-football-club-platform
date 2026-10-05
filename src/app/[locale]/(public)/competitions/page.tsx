import { Trophy } from "lucide-react";
import {
  CompetitionsHub,
  type CompetitionHubData
} from "@/components/competitions/competitions-hub";
import {
  OFFICIAL_CATEGORY_NAMES,
  getCompetitionDisplayData
} from "@/lib/competitions";
import { db } from "@/lib/db";

export default async function PublicCompetitionsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isAr = locale === "ar";
  // Public reads must never create seasons, competitions, fixtures or results.
  const seasons = await db.season.findMany({ orderBy: { startDate: "desc" } });
  const currentSeason = seasons.find((s) => s.isCurrent) || seasons[0] || null;

  // Club details
  const clubSettings = await db.clubSettings.findUnique({ where: { id: "singleton" } });
  const clubName = isAr ? "أمل سيدي حسني" : (clubSettings?.name || "Espoir Sidi Hosni");

  // Load competitions
  const dbCompetitions = await db.competition.findMany({
    include: {
      season: true,
      team: true,
      matches: {
        select: {
          id: true,
          matchDate: true,
          homeTeamName: true,
          awayTeamName: true,
          homeScore: true,
          awayScore: true,
          status: true
        },
        orderBy: { matchDate: "asc" },
        take: 4
      }
    },
    orderBy: { name: "asc" }
  });

  const formattedCompetitions: CompetitionHubData[] = dbCompetitions.map((c) => {
    const cat = c.team?.category || "SENIOR";
    const displayData = getCompetitionDisplayData(c.standingsData, c.bracketData);
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      logoUrl: c.logoUrl,
      organization: c.organization,
      seasonId: c.seasonId,
      seasonLabel: c.season.label,
      category: cat,
      categoryLabelAr: OFFICIAL_CATEGORY_NAMES[cat]?.ar || cat,
      categoryLabelFr: OFFICIAL_CATEGORY_NAMES[cat]?.fr || cat,
      status: c.status,
      ...displayData,
      matches: c.matches
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-10">
      {/* Page Hero Header */}
      <div className="border-b border-border/80 pb-6">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-club-primary">
          <Trophy className="h-4 w-4" />
          {isAr ? "المسابقات والبطولات" : "Compétitions & Tournois"}
        </span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
          {isAr ? "متابعة المسابقات الرسمية للنادي" : "Calendrier & Classements Officiels"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-2xl">
          {isAr
            ? "تعرف على ترتيب أمل سيدي حسني في بطولة الدوري والرسم الهيكلي لمشوار الفريق في كأس الجزائر عبر كافة الفئات"
            : "Suivez le parcours de l'Espoir Sidi Hosni en championnat et en Coupe d'Algérie pour toutes les catégories"}
        </p>
      </div>

      {/* Main Public Competitions Hub (Tabs for League Standings & Algerian Cup Knockout Bracket) */}
      <CompetitionsHub
        competitions={formattedCompetitions}
        seasons={seasons.map((s) => ({ id: s.id, label: s.label, isCurrent: s.isCurrent }))}
        currentSeasonId={currentSeason?.id ?? ""}
        locale={locale}
        canManage={false}
        clubName={clubName}
        isPublic={true}
      />
    </div>
  );
}
