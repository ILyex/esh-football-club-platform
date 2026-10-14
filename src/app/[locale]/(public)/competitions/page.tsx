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
import { frenchCompetitionName, frenchPublicText, localizedClubName } from "@/lib/public/locale-text";
import { PublicPageHeading } from "@/components/public/public-page-heading";

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

  const clubName = isAr ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football";

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
    const localizedStandings = isAr ? displayData.standings : displayData.standings.map((row) => ({
      ...row,
      teamName: frenchPublicText(row.teamName, "Adversaire")
    }));
    const localizedBracket = isAr ? displayData.bracket : {
      rounds: displayData.bracket.rounds.map((round) => ({
        ...round,
        labelFr: frenchPublicText(round.labelFr, "Tour"),
        matches: round.matches.map((match) => ({
          ...match,
          homeTeam: { ...match.homeTeam, name: frenchPublicText(match.homeTeam.name, match.homeTeam.isOurClub ? "Association Sportive Espoir Sidi Hosni de Football" : "Adversaire") },
          awayTeam: { ...match.awayTeam, name: frenchPublicText(match.awayTeam.name, match.awayTeam.isOurClub ? "Association Sportive Espoir Sidi Hosni de Football" : "Adversaire") },
          notes: frenchPublicText(match.notes, "")
        }))
      }))
    };
    return {
      id: c.id,
      name: isAr ? c.name : frenchCompetitionName(c.name),
      type: c.type,
      logoUrl: c.logoUrl,
      organization: c.organization?.trim()
        ? (isAr ? c.organization.trim() : frenchPublicText(c.organization.trim(), ""))
        : null,
      seasonId: c.seasonId,
      seasonLabel: isAr ? c.season.label : frenchPublicText(c.season.label, "Saison"),
      category: cat,
      categoryLabelAr: OFFICIAL_CATEGORY_NAMES[cat]?.ar || cat,
      categoryLabelFr: OFFICIAL_CATEGORY_NAMES[cat]?.fr || cat,
      status: c.status,
      ...displayData,
      standings: localizedStandings,
      bracket: localizedBracket,
      matches: c.matches.map((match) => ({
        ...match,
        homeTeamName: localizedClubName(match.homeTeamName, locale, isAr ? "الفريق المنافس" : "Nom du club adverse"),
        awayTeamName: localizedClubName(match.awayTeamName, locale, isAr ? "الفريق المنافس" : "Nom du club adverse")
      }))
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-10">
      <PublicPageHeading
        locale={locale}
        icon={<Trophy />}
        eyebrow={isAr ? "المسابقات والبطولات" : "Compétitions & Tournois"}
        title={isAr ? "متابعة المسابقات الرسمية" : "Calendrier & Classements Officiels"}
        description={isAr
          ? "تعرف على ترتيب الجمعية الرياضية أمل سيدي حسني لكرة القدم في بطولة الدوري والرسم الهيكلي لمشوار الفريق في كأس الجزائر عبر كافة الفئات"
          : "Suivez le parcours de l'Association Sportive Espoir Sidi Hosni de Football en championnat et en Coupe d'Algérie pour toutes les catégories"}
      />

      {/* Main Public Competitions Hub (Tabs for League Standings & Algerian Cup Knockout Bracket) */}
      <CompetitionsHub
        competitions={formattedCompetitions}
        seasons={seasons.map((s) => ({
          id: s.id,
          label: isAr ? s.label : frenchPublicText(s.label, "Saison"),
          isCurrent: s.isCurrent
        }))}
        currentSeasonId={currentSeason?.id ?? ""}
        locale={locale}
        canManage={false}
        clubName={clubName}
        isPublic={true}
      />
    </div>
  );
}
