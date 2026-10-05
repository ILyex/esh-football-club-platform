import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { deleteTestSessionAction } from "../actions";
import { TestingSessionSheet, type SessionPlayerData } from "@/components/testing/testing-session-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ArrowLeft, ArrowRight, Calendar, MapPin, User, Shield, Timer, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { localizeTestProtocol } from "@/lib/testing/localize-protocol";

export default async function TestingSessionDetailPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requirePermission("players.view");
  const t = await getTranslations("testing");
  const tTeams = await getTranslations("teams");

  const session = await db.testSession.findUnique({
    where: { id },
    include: {
      testDefinition: true,
      team: true,
      conductor: { select: { id: true, name: true, email: true } },
      results: {
        include: {
          measurements: true,
        }
      }
    }
  });

  if (!session) {
    notFound();
  }

  // Enforce authoritative server-side team scoping
  const scopeContext = await getMutationScopeContext();
  try {
    assertTeamScope(scopeContext, session.teamId, "TestSession");
  } catch {
    notFound();
  }

  const canManage = hasPermission(user, "testing.manage") || hasPermission(user, "training.manage") || hasPermission(user, "*");
  const canCorrect = hasPermission(user, "testing.correct") || hasPermission(user, "*");

  // Fetch all active players for this team to build the multi-player roster
  const teamPlayers = await db.player.findMany({
    where: {
      teamId: session.teamId,
      status: { not: "ARCHIVED" }
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      shirtNumber: true,
      position: true,
      photoUrl: true,
    },
    orderBy: [
      { shirtNumber: "asc" },
      { lastName: "asc" },
      { firstName: "asc" }
    ]
  });

  const resultMap = new Map(session.results.map((r) => [r.playerId, r]));
  const legacyIR2ResultsCount = session.testDefinition.code === "YOYO_IR2"
    ? session.results.filter((result) =>
        result.status === "VALID" &&
        !result.measurements.some((measurement) => measurement.key === "level") &&
        !result.measurements.some((measurement) => measurement.key === "shuttle")
      ).length
    : 0;
  const legacyIFTResultsCount = session.testDefinition.code === "IFT_30_15"
    ? session.results.filter((result) =>
        result.status === "VALID" &&
        (result.secondaryScore != null || result.measurements.some((measurement) => measurement.key === "vo2max"))
      ).length
    : 0;
  const legacyIR1ResultsCount = session.testDefinition.code === "YOYO_IR1"
    ? session.results.filter((result) =>
        result.status === "VALID" && result.measurements.some((measurement) => measurement.key === "level" && Number(measurement.numericValue ?? measurement.value) === 8)
      ).length
    : 0;

  // Merge team players with existing results
  const rosterData: SessionPlayerData[] = teamPlayers.map((player) => {
    const existing = resultMap.get(player.id);
    const measurementsObj: Record<string, string | number> = {};
    if (existing?.measurements) {
      for (const m of existing.measurements) {
        measurementsObj[m.key] = m.numericValue ?? m.value;
      }
    }

    return {
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      shirtNumber: player.shirtNumber,
      position: player.position,
      photoUrl: player.photoUrl,
      resultId: existing?.id,
      status: existing?.status ?? (session.testDefinition.code === "YOYO_IR1" || session.testDefinition.code === "YOYO_IR2" ? "INCOMPLETE" : "VALID"),
      summaryScore: existing?.summaryScore,
      secondaryScore: existing?.secondaryScore,
      scoreDisplay: existing?.scoreDisplay,
      rank: existing?.rank,
      isCorrected: existing?.isCorrected,
      correctionReason: existing?.correctionReason,
      notes: existing?.notes,
      measurements: measurementsObj,
    };
  });

  // Sort completed sessions by rank first
  if (session.status === "COMPLETED") {
    rosterData.sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.rank) return -1;
      if (b.rank) return 1;
      return 0;
    });
  }

  async function remove() {
    "use server";
    await deleteTestSessionAction(id);
    redirect(`/${locale}/dashboard/testing`);
  }

  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/dashboard/testing`}>
            <Button variant="outline" size="sm" className="h-9 w-9 p-0">
              <BackIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {session.title}
              </h1>
              <Badge tone="neutral" className="text-xs">
                {session.testDefinition.code}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1 font-semibold text-primary">
                <Shield className="h-3.5 w-3.5" />
                <span>{session.team.name || tTeams(`categories.${session.team.category}` as any)}</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {new Date(session.date).toLocaleDateString(locale === "ar" ? "ar-DZ" : "fr-FR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              {session.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{session.location}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                <span>{session.conductor.name}</span>
              </span>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <ConfirmDialog onConfirm={remove}>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 border-destructive/30 h-9 flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                <span>{t("actions.deleteSession")}</span>
              </Button>
            </ConfirmDialog>
          </div>
        )}
      </div>

      {legacyIR2ResultsCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {locale === "ar"
              ? `تنبيه مراجعة: توجد ${legacyIR2ResultsCount} نتيجة Yo‑Yo IR2 قديمة لا تحتوي المستوى وعدد مرات الذهاب والإياب المسجل. لا يمكن إعادة التحقق من مسافتها تلقائيًا؛ راجع ورقة المدرب قبل اعتمادها.`
              : `À vérifier : ${legacyIR2ResultsCount} ancien(s) résultat(s) Yo‑Yo IR2 ne contiennent pas le niveau et la navette saisis. Leur distance ne peut pas être recalculée automatiquement ; vérifiez la feuille du coach.`}
          </p>
        </div>
      )}

      {legacyIFTResultsCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {locale === "ar"
              ? `تنبيه مراجعة: تحتوي ${legacyIFTResultsCount} نتيجة 30-15 IFT قديمة على تقدير VO₂ مشتق من معادلة غير معتمدة هنا. تبقى النتيجة الأصلية محفوظة؛ راجع قياس VIFT المسجل واعتمد عليه.`
              : `À vérifier : ${legacyIFTResultsCount} ancien(s) résultat(s) 30-15 IFT contiennent une estimation VO₂ calculée avec une équation désormais écartée. Les données restent conservées ; vérifiez la VIFT mesurée.`}
          </p>
        </div>
      )}

      {legacyIR1ResultsCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {locale === "ar"
              ? `تنبيه مراجعة: تحتوي ${legacyIR1ResultsCount} نتيجة Yo‑Yo IR1 قديمة على المستوى 8 الذي لم يعد يطابق جدول السرعات المصحح. أبقينا السجلات كما هي؛ راجع ورقة المدرب قبل تعديل المستوى أو النتيجة.`
              : `À vérifier : ${legacyIR1ResultsCount} ancien(s) résultat(s) Yo‑Yo IR1 utilisent le niveau 8, absent de la table de vitesse corrigée. Les données sont conservées ; vérifiez la feuille du coach avant toute correction.`}
          </p>
        </div>
      )}

      {/* Main Interactive Session Sheet Component */}
      <TestingSessionSheet
        sessionId={session.id}
        sessionTitle={session.title}
        protocolCode={session.testDefinition.code}
        protocolName={localizeTestProtocol(t, session.testDefinition.code, "name", session.testDefinition.name)}
        primaryUnit={session.testDefinition.primaryUnit}
        secondaryUnit={session.testDefinition.secondaryUnit}
        status={session.status}
        canManage={canManage}
        canCorrect={canCorrect}
        players={rosterData}
        locale={locale}
        teamName={session.team.name || tTeams(`categories.${session.team.category}` as any)}
        teamCategory={session.team.category}
        location={session.location}
        date={session.date}
        conductorName={session.conductor.name}
      />
    </div>
  );
}
