import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { resolveUserTeamContext, getEffectiveTeamId } from "@/lib/team-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteTestSessionAction } from "./actions";
import { localizeTestProtocol } from "@/lib/testing/localize-protocol";
import {
  Timer,
  Plus,
  Users,
  Award,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Activity,
  Zap,
  TrendingUp,
  Shield,
  FileText,
  ChevronRight,
  ChevronLeft,
  Trophy
} from "lucide-react";
import {
  TestingAnalyticsCharts,
  type EvolutionPoint,
  type TopAthleteItem
} from "@/components/testing/testing-analytics-charts";

export default async function TestingPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string; status?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const isAr = locale === "ar";
  const user = await requirePermission("players.view");
  const canManage =
    hasPermission(user, "testing.manage") ||
    hasPermission(user, "training.manage") ||
    hasPermission(user, "*");

  const [t, tTeams, teamCtx] = await Promise.all([
    getTranslations("testing"),
    getTranslations("teams"),
    resolveUserTeamContext(sp.team)
  ]);

  const effectiveTeamId = await getEffectiveTeamId(sp.team);
  const authorizedTeamIds = effectiveTeamId
    ? [effectiveTeamId]
    : teamCtx.scope.restricted
    ? teamCtx.authorizedTeams.map((team) => team.id)
    : undefined;

  const whereClause: any = {};
  if (effectiveTeamId) {
    whereClause.teamId = effectiveTeamId;
  } else if (teamCtx.scope.restricted) {
    whereClause.teamId = { in: teamCtx.authorizedTeams.map((t) => t.id) };
  }

  // Status filter if requested
  if (sp.status === "COMPLETED" || sp.status === "DRAFT") {
    whereClause.status = sp.status;
  }

  const [
    sessions,
    protocols,
    totalTestedCount,
    completedSessionsWithResults,
    allValidResults
  ] = await Promise.all([
    db.testSession.findMany({
      where: whereClause,
      include: {
        testDefinition: true,
        team: true,
        conductor: { select: { id: true, name: true } },
        _count: { select: { results: true } }
      },
      orderBy: { date: "desc" }
    }),
    db.testDefinition.findMany({
      where: { active: true },
      orderBy: { displayOrder: "asc" }
    }),
    db.testResult.count({
      where: {
        status: "VALID",
        ...(authorizedTeamIds ? { session: { teamId: { in: authorizedTeamIds } } } : {})
      }
    }),
    db.testSession.findMany({
      where: {
        ...whereClause,
        status: "COMPLETED",
        testDefinition: { code: "YOYO_IR1" },
      },
      include: {
        results: {
          where: { status: "VALID" },
          select: { summaryScore: true, secondaryScore: true }
        }
      },
      orderBy: { date: "asc" },
      take: 8
    }),
    db.testResult.findMany({
      where: {
        status: "VALID",
        session: {
          testDefinition: { code: "YOYO_IR1" },
          ...(authorizedTeamIds ? { teamId: { in: authorizedTeamIds } } : {}),
        },
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            shirtNumber: true,
            position: true,
            photoUrl: true
          }
        }
      },
      orderBy: { summaryScore: "desc" },
      take: 50
    })
  ]);

  const completedCount = sessions.filter((s) => s.status === "COMPLETED").length;
  const draftCount = sessions.filter((s) => s.status === "DRAFT").length;

  // 1. Compute Endurance Evolution Points
  const evolutionData: EvolutionPoint[] = completedSessionsWithResults
    .filter((s) => s.results.length > 0)
    .map((s) => {
      const dists = s.results.map((r) => r.summaryScore || 0).filter((d) => d > 0);
      const avgDist = dists.length > 0 ? Math.round(dists.reduce((a, b) => a + b, 0) / dists.length) : 0;
      const maxDist = dists.length > 0 ? Math.max(...dists) : 0;
      const avgVo2 = avgDist > 0 ? Math.round((avgDist * 0.0084 + 36.4) * 10) / 10 : 0;
      const maxVo2 = maxDist > 0 ? Math.round((maxDist * 0.0084 + 36.4) * 10) / 10 : 0;
      const d = new Date(s.date);
      const dateStr = d.toLocaleDateString(locale === "ar" ? "ar-DZ" : "fr-FR", {
        month: "short",
        day: "numeric"
      });

      return {
        sessionId: s.id,
        sessionTitle: s.title,
        dateStr,
        avgDistance: avgDist,
        maxDistance: maxDist,
        avgVo2,
        maxVo2,
        playerCount: s.results.length
      };
    });

  // 3. Compute Top Athletes Ranking
  const playerBestMap = new Map<string, (typeof allValidResults)[0]>();
  for (const r of allValidResults) {
    if (!playerBestMap.has(r.playerId)) {
      playerBestMap.set(r.playerId, r);
    }
  }

  const topAthletes: TopAthleteItem[] = Array.from(playerBestMap.values())
    .slice(0, 6)
    .map((r) => {
      const dist = Math.round(r.summaryScore || 0);
      const vo2 =
        r.secondaryScore ?? (dist > 0 ? Math.round((dist * 0.0084 + 36.4) * 10) / 10 : 0);
      return {
        id: r.player.id,
        fullName: `${r.player.firstName} ${r.player.lastName}`,
        shirtNumber: r.player.shirtNumber,
        position: r.player.position,
        photoUrl: r.player.photoUrl,
        distance: dist,
        vo2max: Number(vo2),
        levelDisplay: r.scoreDisplay || `${dist} م`,
      };
    });

  const peakDistance = topAthletes.length > 0 ? topAthletes[0]?.distance || 0 : 0;
  const Arrow = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-6">
      {/* 1. Header & Primary Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 border border-emerald-500/20 shadow-xs">
            <Timer className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {locale === "ar" ? "اختبارات اللاعبين" : t("title")}
              </h1>
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm mt-0.5">
              {locale === "ar"
                ? "تسجيل نتائج الاختبارات البدنية ومتابعة تطورها حسب البروتوكول المختار"
                : t("subtitle")}
            </p>
          </div>
        </div>

        {canManage && (
          <Link href={`/${locale}/dashboard/testing/new`}>
            <Button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs text-xs sm:text-sm h-10 px-4">
              <Plus className="h-4 w-4" />
              <span>{t("actions.newSession")}</span>
            </Button>
          </Link>
        )}
      </div>

      {/* 2. Institutional KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* KPI 1: Total Sessions */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">{t("kpi.totalSessions")}</span>
            <Calendar className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-foreground font-mono">{sessions.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {locale === "ar" ? "جلسة مبرمجة بالميدان" : "Sessions programmées"}
          </p>
        </div>

        {/* KPI 2: Completed Sessions */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">{t("kpi.completed")}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {completedCount}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {locale === "ar" ? "محضر فني معتمد رسمياً" : "PV validés officiellement"}
          </p>
        </div>

        {/* KPI 3: Total Athlete Evaluations */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">{t("kpi.testedRecords")}</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-foreground font-mono">{totalTestedCount}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {locale === "ar" ? "سجل أداء فردي موثق" : "Performances individuelles"}
          </p>
        </div>

        {/* KPI 4: Peak Team Distance */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">
              {locale === "ar" ? "الرقم القياسي (القمة)" : "Record Équipe"}
            </span>
            <Trophy className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {peakDistance > 0 ? `${peakDistance.toLocaleString(locale)} م` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {locale === "ar" ? "أعلى مسافة تحمل مسجلة" : "Distance max atteinte"}
          </p>
        </div>
      </div>

      {/* Analytics are limited to Yo-Yo IR1 so incomparable protocols are not mixed. */}
      <TestingAnalyticsCharts
        evolutionData={evolutionData}
        topAthletes={topAthletes}
        locale={locale}
      />

      {/* 4. Filter Strip & Sessions Table Header */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              <span>{locale === "ar" ? "سجل جلسات الاختبار والتقييم الميداني" : t("recentSessions")}</span>
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground">
              {sessions.length}
            </span>
          </div>

          {/* Quick Status Filter Pills */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1 text-xs">
            <Link
              href={`/${locale}/dashboard/testing${sp.team ? `?team=${sp.team}` : ""}`}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                !sp.status ? "bg-card text-foreground shadow-2xs font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {locale === "ar" ? "الكل" : "Tous"}
            </Link>
            <Link
              href={`/${locale}/dashboard/testing?status=COMPLETED${sp.team ? `&team=${sp.team}` : ""}`}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                sp.status === "COMPLETED" ? "bg-card text-foreground shadow-2xs font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {locale === "ar" ? "المكتملة" : "Complétées"} ({completedCount})
            </Link>
            <Link
              href={`/${locale}/dashboard/testing?status=DRAFT${sp.team ? `&team=${sp.team}` : ""}`}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                sp.status === "DRAFT" ? "bg-card text-foreground shadow-2xs font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {locale === "ar" ? "قيد الإجراء" : "En cours"} ({draftCount})
            </Link>
          </div>
        </div>

        {/* Sessions List Table */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          {sessions.length === 0 ? (
            <div className="p-12 text-center">
              <Timer className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-bold text-foreground">
                {locale === "ar" ? "لا توجد جلسات اختبار مسجلة" : t("empty.noSessions")}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {locale === "ar"
                  ? "ابدأ بتنظيم جلسة اختبار جديدة لاختبار تحمل وسرعة لاعبي الفريق وتسجيل النتائج."
                  : t("empty.noSessionsDesc")}
              </p>
              {canManage && (
                <div className="mt-4">
                  <Link href={`/${locale}/dashboard/testing/new`}>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                      <Plus className="h-4 w-4 me-1.5" />
                      <span>{locale === "ar" ? "إنشاء أول جلسة اختبار" : t("actions.newSession")}</span>
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="border-b border-border bg-muted/20 text-xs font-bold text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3.5 text-start">{t("table.session")}</th>
                    <th className="px-4 py-3.5 text-start">{t("table.protocol")}</th>
                    <th className="px-4 py-3.5 text-start">{t("table.team")}</th>
                    <th className="px-4 py-3.5 text-start">{t("table.date")}</th>
                    <th className="px-4 py-3.5 text-center">{t("table.players")}</th>
                    <th className="px-4 py-3.5 text-center">{t("table.status")}</th>
                    <th className="px-4 py-3.5 text-end">{t("table.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sessions.map((sess) => (
                    <tr key={sess.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        <Link
                          href={`/${locale}/dashboard/testing/${sess.id}`}
                          className="hover:text-emerald-600 font-bold transition-colors flex items-center gap-1.5"
                        >
                          <span>{sess.title}</span>
                          <Arrow className="h-3.5 w-3.5 opacity-60" />
                        </Link>
                        {sess.location && (
                          <p className="text-xs text-muted-foreground mt-0.5">{sess.location}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        <span className="font-semibold text-foreground">{localizeTestProtocol(t, sess.testDefinition.code, "name", sess.testDefinition.name)}</span>
                        <span className="block font-mono text-[10px] text-muted-foreground">
                          {sess.testDefinition.code}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                          <Shield className="h-3 w-3" />
                          <span>{tTeams(`categories.${sess.team.category}` as any)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap font-medium">
                        {new Date(sess.date).toLocaleDateString(locale === "ar" ? "ar-DZ" : "fr-FR", {
                          year: "numeric",
                          month: "short",
                          day: "numeric"
                        })}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-center font-bold text-foreground">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">{sess._count.results}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-center">
                        {sess.status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{locale === "ar" ? "مكتمل ومعتمد" : t("status.completed")}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <AlertCircle className="h-3 w-3" />
                            <span>{locale === "ar" ? "قيد الإجراء" : t("status.draft")}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-end whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/${locale}/dashboard/testing/${sess.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8 font-semibold hover:border-emerald-500 hover:text-emerald-600"
                            >
                              {sess.status === "COMPLETED"
                                ? locale === "ar"
                                  ? "معاينة التقرير والنتائج"
                                  : t("actions.viewResults")
                                : locale === "ar"
                                ? "إدخال النتائج"
                                : t("actions.recordScores")}
                            </Button>
                          </Link>
                          {canManage && (
                            <ConfirmDialog
                              onConfirm={async () => {
                                "use server";
                                await deleteTestSessionAction(sess.id);
                              }}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title={t("actions.deleteSession")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </ConfirmDialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Available protocols and their configured calculation methods */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-foreground">
              {locale === "ar" ? "بروتوكولات اختبارات اللاعبين" : t("availableProtocols")}
            </h3>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {locale === "ar" ? "طرق الحساب موضحة حسب البروتوكول" : "Méthodes calculées par protocole"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {protocols.map((proto) => {
            const isYoYo = proto.code.startsWith("YOYO");
            return (
              <div
                key={proto.id}
                className="rounded-xl border border-border/70 bg-muted/15 p-4 space-y-2 hover:border-emerald-500/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 uppercase border border-emerald-500/20">
                    {t(`categories.${proto.category}` as any) || proto.category}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t("protocols.unitLabel")}: <bdi dir="ltr" className="font-mono">{proto.primaryUnit}{proto.secondaryUnit ? ` + ${proto.secondaryUnit}` : ""}</bdi>
                  </span>
                </div>
                <h4 className="text-xs font-bold text-foreground">{localizeTestProtocol(t, proto.code, "name", proto.name)}</h4>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {localizeTestProtocol(t, proto.code, "description", proto.description ?? "")}
                </p>
                {isYoYo && (
                  <div className="pt-2 border-t border-border/40 text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{locale === "ar" ? "حساب تقديري منفصل لكل نسخة" : "Estimation calculée selon chaque version"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
