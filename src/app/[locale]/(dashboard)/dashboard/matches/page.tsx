import { DashboardTeamCategorySelect } from "@/components/shared/dashboard-team-category-select";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { getMatchDisplayNames } from "@/lib/matches/team-names";
import { Button } from "@/components/ui/button";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { MatchDocumentPreviewButton } from "@/components/matches/match-document-preview-button";
import { MatchOperationalStatus } from "@/components/matches/match-operational-status";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteMatchAction } from "./actions";
import { resolveMatchResult } from "@/lib/matches/result";
import { LiveMatchRefresh } from "@/components/public/live-match-refresh";
import { formatAlgeriaDate, formatAlgeriaTime } from "@/lib/dates/algeria";

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
  const canDelete = hasPermission(user, "matches.delete");
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
      include: {
        competition: true,
        team: true,
        documents: { select: { id: true, name: true, matchDocumentType: true } },
        shootoutKicks: { select: { side: true, result: true } }
      },
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
      <LiveMatchRefresh enabled={matches.some((match) => match.status === "LIVE")} />
      <div className="mb-6 grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="text-center sm:col-start-2 sm:row-start-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === "ar"
              ? "برمجة المباريات، متابعة النتائج، ونشرها تلقائياً على الموقع الرسمي للنادي"
              : "Planification des matchs, résultats et publication directe sur le site officiel"}
          </p>
        </div>
        <div aria-hidden="true" className="hidden sm:col-start-1 sm:row-start-1 sm:block" />
        <div className="flex items-center justify-center gap-2 sm:col-start-3 sm:row-start-1 sm:justify-self-end">
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
          options={[{ id: "", label: tCommon("filter") }, ...["SCHEDULED", "LIVE", "FINISHED", "POSTPONED"].map((s) => ({ id: s, label: t(`statuses.${s}` as any) }))]}
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

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full text-start text-xs sm:text-sm">
          <thead className="border-b border-border bg-muted/50 text-start">
            <tr>
              <th className="w-[132px] px-3 py-3 text-start sm:w-40 sm:px-4">{t("fields.matchDate")}</th>
              <th className="px-3 py-3 text-start sm:px-4">{t("title")}</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const { homeTeamName, awayTeamName } = getMatchDisplayNames(m, locale);
              const matchTitle = `${homeTeamName} ${locale === "ar" ? "ضد" : "vs"} ${awayTeamName}`;
              const scoreIsActive = m.status === "LIVE" || m.status === "FINISHED";
              const homeScore = scoreIsActive ? (m.homeScore ?? 0) : "–";
              const awayScore = scoreIsActive ? (m.awayScore ?? 0) : "–";
              const outcome = resolveMatchResult(m);
              const winnerName = outcome.winnerSide === "HOME" ? homeTeamName : outcome.winnerSide === "AWAY" ? awayTeamName : null;
              async function removeMatch() {
                "use server";
                await deleteMatchAction(m.id);
              }
              return (
                <tr key={m.id} className="border-b border-border/70 last:border-0 align-middle transition-colors hover:bg-muted/20">
                  <td className="px-3 py-3 text-start sm:px-4">
                    <span dir="ltr" className="flex flex-col items-start gap-0.5 whitespace-nowrap font-mono text-[11px] tabular-nums sm:text-xs">
                      <time dateTime={m.matchDate.toISOString()}>{formatAlgeriaDate(m.matchDate)}</time>
                      <time className="text-muted-foreground" dateTime={m.matchDate.toISOString()}>{formatAlgeriaTime(m.matchDate, locale)}</time>
                    </span>
                  </td>
                  <td className="px-3 py-3 align-middle font-medium sm:px-4">
                    <span dir={locale === "ar" ? "rtl" : "ltr"} className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-3">
                      <span dir="auto" title={homeTeamName} className="min-w-0 truncate text-end leading-tight">{homeTeamName}</span>
                      <span dir="ltr" className="inline-flex min-w-[54px] items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-border/70 bg-muted/70 px-2 py-1.5 text-center font-mono text-xs font-extrabold tabular-nums shadow-sm sm:min-w-[68px] sm:px-2.5">
                        <span>{homeScore}</span>
                        <span className="text-muted-foreground/70">:</span>
                        <span>{awayScore}</span>
                      </span>
                      <span dir="auto" title={awayTeamName} className="min-w-0 truncate text-start leading-tight">{awayTeamName}</span>
                    </span>
                    {winnerName && (
                      <p className="mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {locale === "ar" ? `الفائز: ${winnerName}` : `Vainqueur : ${winnerName}`}
                        {outcome.decidedByPenalties && <span dir="ltr" className="ms-1 font-mono">({outcome.homePenaltyScore}–{outcome.awayPenaltyScore})</span>}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2">
                      <span className="rounded-full bg-muted/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground">{m.team ? tTeams(`categories.${m.team.category}` as any) : "—"}</span>
                      <span className="max-w-full truncate rounded-full bg-muted/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground sm:max-w-[240px]" title={m.competition.name}>{m.competition.name}</span>
                      <MatchOperationalStatus
                        status={m.status}
                        matchDate={m.matchDate}
                        locale={locale}
                        labels={{
                          SCHEDULED: t("statuses.SCHEDULED"),
                          LIVE: t("statuses.LIVE"),
                          FINISHED: t("statuses.FINISHED"),
                          POSTPONED: t("statuses.POSTPONED"),
                          CANCELLED: t("statuses.CANCELLED")
                        }}
                        hasExtraTime={m.hasExtraTime}
                        hasPenaltyShootout={m.hasPenaltyShootout}
                        homeScore={m.homeScore}
                        awayScore={m.awayScore}
                        addedTime={{
                          firstHalf: m.firstHalfAddedTime,
                          secondHalf: m.secondHalfAddedTime,
                          extraTimeFirstHalf: m.extraTimeFirstHalfAddedTime,
                          extraTimeSecondHalf: m.extraTimeSecondHalfAddedTime
                        }}
                      />
                      <MatchDocumentPreviewButton
                        matchId={m.id}
                        matchTitle={matchTitle}
                        locale={locale}
                        existingDocuments={m.documents}
                      />
                      <div className="ms-auto flex items-center gap-1.5">
                        <Link
                          href={`/${locale}/dashboard/matches/${m.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[11px] font-semibold text-club-primary transition-colors hover:border-club-primary/40 hover:bg-club-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40 sm:h-9 sm:px-3 sm:text-xs"
                          aria-label={t("manage")}
                          title={t("manage")}
                        >
                          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{t("manage")}</span>
                        </Link>
                        {canDelete && (
                          <ConfirmDialog
                            onConfirm={removeMatch}
                            title={locale === "ar" ? "حذف المباراة؟" : "Supprimer le match ?"}
                            body={locale === "ar" ? `سيتم حذف مباراة ${matchTitle} نهائياً.` : `Le match ${matchTitle} sera supprimé définitivement.`}
                            successMessage={locale === "ar" ? "تم حذف المباراة بنجاح" : "Match supprimé avec succès"}
                            errorMessage={locale === "ar" ? "تعذر حذف المباراة" : "Impossible de supprimer le match"}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg border border-border p-0 text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive sm:h-9 sm:w-9"
                              aria-label={locale === "ar" ? "حذف المباراة" : "Supprimer le match"}
                              title={locale === "ar" ? "حذف المباراة" : "Supprimer le match"}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </ConfirmDialog>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {matches.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                  {tCommon("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5 text-xs text-muted-foreground">
        <p className="rounded-full bg-muted/60 px-3 py-1.5 font-semibold">
          {locale === "ar" ? `${total} مباراة · الصفحة ${page} من ${totalPages}` : `${total} matchs · page ${page} sur ${totalPages}`}
        </p>
        <nav aria-label={locale === "ar" ? "صفحات المباريات" : "Pages des matchs"} className="flex gap-1.5">
          {page > 1 && (
            <Link aria-label={locale === "ar" ? "الصفحة السابقة" : "Page précédente"} href={`/${locale}/dashboard/matches?${new URLSearchParams({ ...sp, page: String(page - 1) } as any)}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-club-primary transition-colors hover:bg-club-primary/10">
              ‹
            </Link>
          )}
          {page < totalPages && (
            <Link aria-label={locale === "ar" ? "الصفحة التالية" : "Page suivante"} href={`/${locale}/dashboard/matches?${new URLSearchParams({ ...sp, page: String(page + 1) } as any)}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-club-primary transition-colors hover:bg-club-primary/10">
              ›
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
