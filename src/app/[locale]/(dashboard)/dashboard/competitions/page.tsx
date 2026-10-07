import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Plus, Trophy, Layers } from "lucide-react";
import { SeasonCreatorForm } from "@/components/competitions/season-creator-form";
import {
  CompetitionsHub,
  type CompetitionHubData
} from "@/components/competitions/competitions-hub";
import {
  OFFICIAL_CATEGORY_NAMES,
  getCompetitionDisplayData
} from "@/lib/competitions";
import { createSeasonAction } from "./actions";

export default async function CompetitionsListPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isAr = locale === "ar";
  const user = await requirePagePermission("competitions.view", locale);
  const t = await getTranslations("competitions");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "competitions.manage");

  // Fetch seasons & club settings
  let seasons = await db.season.findMany({ orderBy: { startDate: "desc" } });
  const clubSettings = await db.clubSettings.findUnique({ where: { id: "singleton" } });
  const clubName = locale === "ar"
    ? (clubSettings?.name || "الجمعية الرياضية أمل سيدي حسني لكرة القدم")
    : "Association Sportive Espoir Sidi Hosni de Football";

  const currentSeason = seasons.find((s) => s.isCurrent) || seasons[0] || null;

  // Load all competitions
  const dbCompetitions = await db.competition.findMany({
    include: {
      season: true,
      team: true,
      matches: {
        select: { id: true, matchDate: true, homeTeamName: true, awayTeamName: true, homeScore: true, awayScore: true, status: true },
        orderBy: { matchDate: "desc" },
        take: 5
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

  async function addSeason(_prevState: { id?: string; error?: string } | undefined, formData: FormData) {
    "use server";
    return createSeasonAction(formData);
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Management Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Trophy className="h-6 w-6 text-club-primary" />
            <span>{isAr ? "المسابقات والبطولات الرسمية" : "Compétitions Officielles"}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isAr
              ? "متابعة وإدارة جدول ترتيب بطولة الدوري والرسم الهيكلي لمسابقة كأس الجزائر لجميع الفئات والمواسم"
              : "Gestion du championnat et de l'arbre éliminatoire de la Coupe d'Algérie"}
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Link href={`/${locale}/dashboard/competitions/new`}>
              <Button size="sm" className="gap-1.5 font-bold shadow-xs">
                <Plus className="h-4 w-4" />
                <span>{t("addCompetition")}</span>
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Main Interactive Competitions Hub (Unified League Table & Cup Bracket) */}
      <CompetitionsHub
        competitions={formattedCompetitions}
        seasons={seasons.map((s) => ({ id: s.id, label: s.label, isCurrent: s.isCurrent }))}
        currentSeasonId={currentSeason?.id ?? ""}
        locale={locale}
        canManage={canManage}
        clubName={clubName}
        isPublic={false}
      />

      {/* Inline Season Creator (For Future Seasons) */}
      {canManage && (
        <div id="season-creator" className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
          <div className="border-b border-border/60 pb-3 mb-4">
            <h3 className="text-sm font-bold text-foreground">
              {isAr ? "إضافة وتخزين موسم رياضي مستقبلي" : "Ajouter une saison future"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "يمكنك إنشاء مواسم مستقبلية (مثل 2027/2028) وتخزين بيانات مسابقاتها مسبقاً"
                : "Planifiez les saisons à venir et stockez leurs données"}
            </p>
          </div>

          <SeasonCreatorForm locale={locale} action={addSeason} />
        </div>
      )}
    </div>
  );
}
