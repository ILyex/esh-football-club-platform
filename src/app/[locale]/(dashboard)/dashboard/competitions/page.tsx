import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Plus, Trophy, Layers } from "lucide-react";
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
  const user = await requirePermission("competitions.view");
  const t = await getTranslations("competitions");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "competitions.manage");

  // Fetch seasons & club settings
  let seasons = await db.season.findMany({ orderBy: { startDate: "desc" } });
  const clubSettings = await db.clubSettings.findUnique({ where: { id: "singleton" } });
  const clubName = clubSettings?.name || "أمل سيدي حسني (ESH)";

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

  async function addSeason(formData: FormData) {
    "use server";
    await createSeasonAction(formData);
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
        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
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

          <form action={addSeason} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {isAr ? "تسمية الموسم" : "Libellé"}
              </label>
              <input
                type="text"
                name="label"
                placeholder="2027/2028"
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-club-primary focus:outline-hidden"
              />
            </div>
            <div>
              <DateInput
                label={isAr ? "تاريخ البداية" : "Date de début"}
                name="startDate"
                required
                locale={locale}
              />
            </div>
            <div>
              <DateInput
                label={isAr ? "تاريخ النهاية" : "Date de fin"}
                name="endDate"
                required
                locale={locale}
              />
            </div>
            <div>
              <Button type="submit" variant="outline" size="sm" className="w-full font-bold">
                <Plus className="h-4 w-4 me-1" />
                <span>{isAr ? "حفظ الموسم" : "Créer saison"}</span>
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
