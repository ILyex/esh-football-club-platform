import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { getCurrentTeamId } from "@/lib/team-context";
import { createMatchAction } from "../actions";
import { redirect } from "next/navigation";
import { getAllOpponentsList } from "@/lib/opponents";
import { MatchFormClient } from "@/components/matches/match-form-client";

export default async function NewMatchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePermission("matches.create");
  const t = await getTranslations("matches");
  const tCommon = await getTranslations("common");

  const [competitions, teams, currentTeamId, savedOpponents, clubSettings] = await Promise.all([
    db.competition.findMany({ orderBy: { name: "asc" } }),
    db.team.findMany({ where: { active: true }, orderBy: { category: "asc" } }),
    getCurrentTeamId(),
    getAllOpponentsList(),
    db.clubSettings.findUnique({ where: { id: "singleton" } })
  ]);

  async function action(formData: FormData) {
    "use server";
    const { id } = await createMatchAction(formData);
    redirect(`/${locale}/dashboard/matches/${id}`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-border/70 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-foreground">{t("addMatch")}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {locale === "ar"
            ? "برمجة مباراة رسمية جديدة، تحديد المضيف والضيف، رفع شعار الخصم، ونشرها المباشر على الموقع الرسمي"
            : "Planification d'un nouveau match, gestion des logos et publication directe sur le portail public"}
        </p>
      </div>

      {competitions.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">{tCommon("noResults")}</p>
      ) : (
        <MatchFormClient
          locale={locale}
          competitions={competitions.map((c) => ({ id: c.id, name: c.name }))}
          teams={teams.map((tm) => ({ id: tm.id, name: tm.name, category: tm.category }))}
          savedOpponents={savedOpponents}
          defaultTeamId={currentTeamId}
          clubName={
            locale === "ar"
              ? (clubSettings?.name && /[\u0600-\u06FF]/.test(clubSettings.name)
                  ? clubSettings.name
                  : "أمل سيدي حسني")
              : (clubSettings?.shortName && clubSettings.shortName.length > 3
                  ? clubSettings.shortName
                  : "ESPOIRE SIDI HOSNI")
          }
          action={action}
        />
      )}
    </div>
  );
}
