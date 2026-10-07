import { DashboardTeamCategorySelect } from "@/components/shared/dashboard-team-category-select";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { MatchDocumentPreviewButton } from "@/components/matches/match-document-preview-button";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  SCHEDULED: "neutral",
  LIVE: "danger",
  FINISHED: "success",
  POSTPONED: "warning",
  CANCELLED: "warning"
};

export default async function MatchesListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; competitionId?: string; team?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("matches.view", locale);
  const t = await getTranslations("matches");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canCreate = hasPermission(user, "matches.create");

  const pageSize = 20;
  const page = Math.max(1, Number(sp.page ?? "1"));
  const effectiveTeamId = await getEffectiveTeamId(sp.team);
  const where = {
    ...(sp.status ? { status: sp.status as any } : {}),
    ...(sp.competitionId ? { competitionId: sp.competitionId } : {}),
    ...(effectiveTeamId ? { teamId: effectiveTeamId } : {})
  };

  const [matches, total, competitions, teams] = await Promise.all([
    db.match.findMany({
      where,
      include: { competition: true, team: true, documents: { select: { id: true, name: true, matchDocumentType: true } } },
      orderBy: { matchDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    db.match.count({ where }),
    db.competition.findMany({ orderBy: { name: "asc" } }),
    getAuthorizedTeams()
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === "ar"
              ? "برمجة المباريات، متابعة النتائج، ونشرها تلقائياً على الموقع الرسمي للنادي"
              : "Planification des matchs, résultats et publication directe sur le site officiel"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Link href={`/${locale}/dashboard/matches/new`}>
              <Button size="sm" className="gap-1.5 text-xs font-bold">
                <Plus className="h-3.5 w-3.5" />
                <span>{t("addMatch")}</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      <form className="dashboard-filter-toolbar mb-4">
        <DashboardTeamCategorySelect
          value={sp.team ?? effectiveTeamId ?? "ALL"}
          options={teams.map((tm) => ({ id: tm.id, label: tTeams(`categories.${tm.category}` as any) }))}
          allLabel={tTeams("allTeams")}
          locale={locale}
        />
        <MasterFilterSelect
          name="status"
          locale={locale === "ar" ? "ar" : "fr"}
          label={tCommon("status")}
          value={sp.status ?? ""}
          options={[{ id: "", label: tCommon("filter") }, ...["SCHEDULED", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"].map((s) => ({ id: s, label: t(`statuses.${s}` as any) }))]}
          headerTitle={locale === "ar" ? "تصفية حسب حالة المباراة" : "Filtrer par statut du match"}
        />
        <MasterFilterSelect
          name="competitionId"
          locale={locale === "ar" ? "ar" : "fr"}
          label={t("fields.competition")}
          value={sp.competitionId ?? ""}
          options={[{ id: "", label: t("fields.competition") }, ...competitions.map((c) => ({ id: c.id, label: c.name }))]}
          headerTitle={locale === "ar" ? "تصفية حسب المسابقة" : "Filtrer par compétition"}
        />
        <Button type="submit" variant="outline">
          {tCommon("filter")}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[650px] text-start text-sm">
          <thead className="border-b border-border bg-muted/50 text-start">
            <tr>
              <th className="px-4 py-2 text-start">{t("fields.matchDate")}</th>
              <th className="px-4 py-2 text-start">{t("title")}</th>
              <th className="px-4 py-2 text-start">{tTeams("title")}</th>
              <th className="px-4 py-2 text-start">{t("fields.competition")}</th>
              <th className="px-4 py-2 text-start">{tCommon("status")}</th>
              <th className="px-4 py-2 text-start">{locale === "ar" ? "وثائق المباراة" : "Documents du match"}</th>
              <th className="px-4 py-2 text-start">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const matchTitle = `${m.homeTeamName} ضد ${m.awayTeamName}`;
              return (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(m.matchDate)}</td>
                  <td className="px-4 py-2 font-medium">
                    {m.homeTeamName} {m.homeScore ?? "-"} : {m.awayScore ?? "-"} {m.awayTeamName}
                  </td>
                  <td className="px-4 py-2">{m.team ? tTeams(`categories.${m.team.category}` as any) : "—"}</td>
                  <td className="px-4 py-2">{m.competition.name}</td>
                  <td className="px-4 py-2">
                    <Badge tone={STATUS_TONE[m.status]}>{t(`statuses.${m.status}` as any)}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <MatchDocumentPreviewButton
                      matchId={m.id}
                      matchTitle={matchTitle}
                      locale={locale}
                      existingDocuments={m.documents}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/${locale}/dashboard/matches/${m.id}`} className="text-sm text-club-primary underline">
                      {tCommon("edit")}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {matches.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {tCommon("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <p>
          {total} • {tCommon("view")} {page}/{totalPages}
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={`/${locale}/dashboard/matches?${new URLSearchParams({ ...sp, page: String(page - 1) } as any)}`} className="text-club-primary underline">
              ‹
            </Link>
          )}
          {page < totalPages && (
            <Link href={`/${locale}/dashboard/matches?${new URLSearchParams({ ...sp, page: String(page + 1) } as any)}`} className="text-club-primary underline">
              ›
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
