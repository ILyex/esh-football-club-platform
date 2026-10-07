import { Plus } from "lucide-react";
import { DashboardTeamCategorySelect } from "@/components/shared/dashboard-team-category-select";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  SCHEDULED: "neutral",
  COMPLETED: "success",
  CANCELLED: "danger"
};

export default async function TrainingListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("training.view", locale);
  const t = await getTranslations("training");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "training.manage");

  const effectiveTeamId = await getEffectiveTeamId(sp.team);

  const [sessions, teams] = await Promise.all([
    db.trainingSession.findMany({
      where: effectiveTeamId ? { teamId: effectiveTeamId } : {},
      include: { coach: true, team: true, _count: { select: { attendances: true } } },
      orderBy: { date: "desc" },
      take: 50
    }),
    getAuthorizedTeams()
  ]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        {canManage && (
          <Link href={`/${locale}/dashboard/training/new`}>
            <Button className="inline-flex items-center gap-2"><Plus className="h-4 w-4 shrink-0" aria-hidden="true" />{t("addSession")}</Button>
          </Link>
        )}
      </div>

      <form className="dashboard-filter-toolbar mb-4">
        <DashboardTeamCategorySelect
          value={sp.team ?? effectiveTeamId ?? "ALL"}
          options={teams.map((tm) => ({ id: tm.id, label: tTeams(`categories.${tm.category}` as any) }))}
          allLabel={tTeams("allTeams")}
          locale={locale}
        />
        <Button type="submit" variant="outline">
          {tCommon("filter")}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[650px] text-start text-sm">
          <thead className="border-b border-border bg-muted/50 text-start">
            <tr>
              <th className="px-4 py-2 text-start">{t("fields.date")}</th>
              <th className="px-4 py-2 text-start">{tTeams("title")}</th>
              <th className="px-4 py-2 text-start">{t("fields.location")}</th>
              <th className="px-4 py-2 text-start">{t("fields.coach")}</th>
              <th className="px-4 py-2 text-start">{t("fields.status")}</th>
              <th className="px-4 py-2 text-start">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(s.date)}</td>
                <td className="px-4 py-2">{s.team ? tTeams(`categories.${s.team.category}` as any) : "—"}</td>
                <td className="px-4 py-2">{s.location ?? "—"}</td>
                <td className="px-4 py-2">{s.coach ? `${s.coach.firstName} ${s.coach.lastName}` : "—"}</td>
                <td className="px-4 py-2">
                  <Badge tone={STATUS_TONE[s.status]}>{t(`statuses.${s.status}` as any)}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/${locale}/dashboard/training/${s.id}`} className="text-sm text-club-primary underline">
                    {tCommon("edit")}
                  </Link>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {tCommon("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
