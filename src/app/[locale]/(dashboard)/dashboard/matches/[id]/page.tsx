import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/utils";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { notFound, redirect } from "next/navigation";
import {
  updateMatchAction,
  deleteMatchAction,
  addMatchEventAction,
  updateMatchEventAction,
  deleteMatchEventAction,
  upsertLineupEntryAction,
  swapMatchLineupPositionsAction,
  removeLineupEntryAction,
  attachMatchSheetAction,
  addShootoutKickAction,
  deleteShootoutKickAction,
  syncPreviousMatchRedCardSuspensionsAction
} from "../actions";
import { Button } from "@/components/ui/button";
import { IMAGE_UPLOAD_ACTION, IMAGE_UPLOAD_FRAME, IMAGE_UPLOAD_PREVIEW } from "@/components/ui/image-upload-frame";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal";
import { FormSelect } from "@/components/ui/form-select";
import { MatchEditStatusFields } from "@/components/matches/match-edit-status-fields";
import { Save, FileCheck, FileText, Download, Upload, Target, CircleDot, Square, UserCheck, Trophy, MapPin, CalendarDays, Sparkles, Trash2, CircleCheck, CircleX, Shield, ChevronDown } from "lucide-react";
import { getOpponentLogo } from "@/lib/opponents";
import { frenchCompetitionName } from "@/lib/public/locale-text";
import { DocumentUploadPicker } from "@/components/documents/document-upload-picker";
import { MatchLineupWorkspace } from "@/components/matches/match-lineup-workspace";
import { RefereeNamesInput } from "@/components/matches/referee-names-input";
import { MatchPeriodOptions } from "@/components/matches/match-period-options";
import { MatchEditFixtureFields } from "@/components/matches/match-edit-fixture-fields";
import { MatchEventForm } from "@/components/matches/match-event-form";
import { MatchEventEditDialog } from "@/components/matches/match-event-edit-dialog";
import { MatchManagementTabs } from "@/components/matches/match-management-tabs";
import { OpponentNameInputs } from "@/components/matches/opponent-name-inputs";
import { OpponentCrest } from "@/components/public/opponent-crest";
import { getMatchClockState } from "@/lib/matches/clock";
import { ShootoutKickForm } from "@/components/matches/shootout-kick-form";
import { MatchLiveClock } from "@/components/matches/match-live-clock";
import { FafEmsSyncButton } from "@/components/matches/faf-ems-sync-button";
import { getMatchDisplayNames } from "@/lib/matches/team-names";
import { ActionFeedbackForm } from "@/components/shared/action-feedback-form";
import { PreMatchSheetUploadGate } from "@/components/matches/pre-match-sheet-upload-gate";
import { arabicRefereeNames, getRefereeRoleLabel, splitRefereeNames } from "@/lib/matches/referees";
import { splitClubNameVariants } from "@/lib/public/locale-text";
import { getMatchFormError } from "@/lib/matches/form-error";
import { resolveMatchResult } from "@/lib/matches/result";
import { groupSubstitutionEvents } from "@/lib/matches/group-substitution-events";

const EVENT_TYPES = ["GOAL", "SHOT", "PENALTY_GOAL", "PENALTY_MISSED", "PENALTY_AWARDED", "OWN_GOAL", "ASSIST", "YELLOW_CARD", "RED_CARD", "SUBSTITUTION_IN", "SUBSTITUTION_OUT"] as const;

export default async function MatchDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requirePagePermission("matches.view", locale);
  const t = await getTranslations("matches");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canUpdate = hasPermission(user, "matches.update");
  const canReport = hasPermission(user, "matches.report");
  const canDelete = hasPermission(user, "matches.delete");

  const [match, competitions, players, teams, staff] = await Promise.all([
    db.match.findUnique({
      where: { id },
      include: {
        competition: true,
        events: { include: { player: true, staff: true, shot: { include: { assistPlayer: true } } }, orderBy: { minute: "asc" } },
        lineups: { include: { player: true } },
        documents: { orderBy: { createdAt: "desc" } },
        shootoutKicks: { orderBy: [{ attemptNumber: "asc" }, { createdAt: "asc" }] }
      }
    }),
    db.competition.findMany({ orderBy: { name: "asc" } }),
    db.player.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { lastName: "asc" } }),
    db.team.findMany({ orderBy: { category: "asc" } }),
    db.staff.findMany({ where: { status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] })
  ]);
  if (!match) notFound();
  const canManageLineup = canReport && (match.status === "SCHEDULED" || match.status === "LIVE");
  const { homeTeamName, awayTeamName } = getMatchDisplayNames(match, locale);
  const displayedEvents = groupSubstitutionEvents(match.events);

  const scopeContext = await getMutationScopeContext();
  try {
    assertTeamScope(scopeContext, match.teamId, "Match", { allowClubWide: true });
  } catch {
    notFound();
  }

  const opponentStoredName = match.isHomeFixture ? match.awayTeamName : match.homeTeamName;
  const opponentNames = splitClubNameVariants(opponentStoredName);
  const opponent = opponentNames.ar || opponentStoredName;
  const localizedRefereeNames = locale === "fr"
    ? match.refereeNameFr || match.refereeNameAr || match.refereeName
    : arabicRefereeNames(match.refereeNameAr, match.refereeNameFr, match.refereeName);
  const refereeNames = splitRefereeNames(localizedRefereeNames);
  const showRefereeReport = match.status === "FINISHED" || match.status === "CANCELLED";
  const opponentLogo = await getOpponentLogo(opponent);
  const previousCompetitionMatch = await db.match.findFirst({
    where: {
      competitionId: match.competitionId,
      teamId: match.teamId ?? undefined,
      matchDate: { lt: match.matchDate },
      status: "FINISHED"
    },
    orderBy: { matchDate: "desc" },
    select: {
      matchDate: true,
      events: {
        where: { type: "RED_CARD", playerId: { not: null } },
        select: { playerId: true }
      }
    }
  });
  const previousRedCardPlayerIds = new Set(
    previousCompetitionMatch?.events.flatMap((event) => event.playerId ? [event.playerId] : []) ?? []
  );
  const matchTeamCategory = teams.find((team) => team.id === match.teamId)?.category;
  const teamCategoryById = new Map(teams.map((team) => [team.id, team.category]));
  const trackedPlayers = players.filter((player) =>
    player.teamId === match.teamId || (matchTeamCategory === "SENIOR" && teamCategoryById.get(player.teamId ?? "") === "U20")
  );
  const getLineupStatus = (lineup: (typeof match.lineups)[number]) =>
    lineup.selectionStatus ?? (lineup.isStarting ? "STARTING" : "SUBSTITUTE");
  const startingPlayers = match.lineups.filter((lineup) => getLineupStatus(lineup) === "STARTING");
  const substitutePlayers = match.lineups.filter((lineup) => getLineupStatus(lineup) === "SUBSTITUTE");
  const addedTime = {
    firstHalf: match.firstHalfAddedTime,
    secondHalf: match.secondHalfAddedTime,
    extraTimeFirstHalf: match.extraTimeFirstHalfAddedTime,
    extraTimeSecondHalf: match.extraTimeSecondHalfAddedTime
  };
  const liveClock = getMatchClockState(match.matchDate, new Date(), match.hasExtraTime, match.hasPenaltyShootout, match.homeScore, match.awayScore, addedTime);
  const shootoutReady = match.status === "LIVE" && liveClock.phase === "PENALTIES";
  const resolvedResult = resolveMatchResult(match);
  const winnerName = resolvedResult.winnerSide === "HOME" ? homeTeamName : resolvedResult.winnerSide === "AWAY" ? awayTeamName : null;
  const scoresAreTied = match.homeScore != null && match.awayScore != null && match.homeScore === match.awayScore;
  const resultNeedsShootout = match.status === "FINISHED" && scoresAreTied && match.hasPenaltyShootout && !winnerName;
  const matchIsDraw = match.status === "FINISHED" && scoresAreTied && !match.hasPenaltyShootout;

  async function update(formData: FormData) {
    "use server";
    try {
      return await updateMatchAction(id, formData);
    } catch (error) {
      console.error("[Match] update failed", error);
      return getMatchFormError(error, locale);
    }
  }
  async function remove() {
    "use server";
    await deleteMatchAction(id);
    redirect(`/${locale}/dashboard/matches`);
  }
  async function addEvent(formData: FormData) {
    "use server";
    await addMatchEventAction(id, formData);
  }
  async function addLineupEntry(formData: FormData) {
    "use server";
    await upsertLineupEntryAction(id, formData);
  }
  async function removeLineupPlayer(playerId: string) {
    "use server";
    await removeLineupEntryAction(id, playerId);
  }
  async function swapLineupPositions(playerId: string, targetPlayerId: string, position: string, targetPosition: string) {
    "use server";
    await swapMatchLineupPositionsAction(id, playerId, targetPlayerId, position, targetPosition);
  }
  async function syncLineupSuspensions() {
    "use server";
    return syncPreviousMatchRedCardSuspensionsAction(id);
  }
  async function attachSheet(formData: FormData) {
    "use server";
    return await attachMatchSheetAction(id, formData);
  }
  async function addShootoutKick(formData: FormData) {
    "use server";
    await addShootoutKickAction(id, formData);
  }
  async function deleteShootoutKick(kickId: string) {
    "use server";
    await deleteShootoutKickAction(id, kickId);
  }
  const preMatchSheet = match.documents.find((d) =>
    d.matchDocumentType === "PRE_MATCH_SHEET" ||
    (d.matchDocumentType === null && (
      d.name.includes("ورقة التشكيل") ||
      d.name.includes("قبل اللقاء") ||
      /composition|line.?up|pre.?match|engagement/i.test(`${d.name} ${d.originalName ?? ""}`)
    ))
  );

  const refereeReport = match.documents.find((d) =>
    d.matchDocumentType === "REFEREE_REPORT" ||
    (d.matchDocumentType === null && (
      d.name.includes("تقرير حكم") ||
      /rapport|referee|arbitre/i.test(`${d.name} ${d.originalName ?? ""}`)
    ))
  );

  const matchDataTab = { id: "match-data", label: locale === "ar" ? "بيانات المباراة" : "Données du match" };
  const lineupTab = { id: "match-lineup", label: t("lineup.title") };
  const documentsTab = { id: "match-documents", label: locale === "ar" ? "وثائق المباراة" : "Documents du match" };
  const eventsTab = { id: "match-events", label: t("events.title") };
  const shootoutTab = { id: "match-shootout", label: locale === "ar" ? "ركلات الترجيح" : "Tirs au but" };
  const managementTabs = match.status === "LIVE"
    ? [matchDataTab, eventsTab, lineupTab, ...(match.hasPenaltyShootout ? [shootoutTab] : []), documentsTab]
    : match.status === "FINISHED"
      ? [matchDataTab, eventsTab, documentsTab, lineupTab, ...(match.hasPenaltyShootout ? [shootoutTab] : [])]
      : match.status === "POSTPONED" || match.status === "CANCELLED"
        ? [matchDataTab, documentsTab, lineupTab, eventsTab, ...(match.hasPenaltyShootout ? [shootoutTab] : [])]
        : [matchDataTab, lineupTab, documentsTab, eventsTab, ...(match.hasPenaltyShootout ? [shootoutTab] : [])];

  const homeLogoUrl = match.isHomeFixture ? "/branding/esh-logo-128.png" : opponentLogo;
  const awayLogoUrl = match.isHomeFixture ? opponentLogo : "/branding/esh-logo-128.png";
  const matchStatusLabel = match.status === "LIVE" ? t("statuses.LIVE")
    : match.status === "FINISHED" ? t("statuses.FINISHED")
      : match.status === "POSTPONED" ? t("statuses.POSTPONED")
        : match.status === "CANCELLED" ? t("statuses.CANCELLED")
          : t("statuses.SCHEDULED");

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <section className="relative isolate overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b from-club-primary/[0.07] to-transparent" aria-hidden="true" />
        <div className="space-y-5 p-4 sm:p-6">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-bold text-club-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-club-primary" aria-hidden="true" />
                {t("manage")}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {locale === "ar" ? match.competition.name : frenchCompetitionName(match.competition.name)}
                {matchTeamCategory && <span> · {locale === "ar" ? ({ SENIOR: "الأكابر", U20: "U20", U17: "U17", U15: "U15" } as Record<string, string>)[matchTeamCategory] : matchTeamCategory}</span>}
              </p>
            </div>
            <Badge className={`shrink-0 border px-3 py-1 text-[11px] font-bold ${match.status === "LIVE" ? "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400" : match.status === "FINISHED" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border bg-muted/60 text-muted-foreground"}`}>
              {matchStatusLabel}
            </Badge>
          </header>

          <div dir="ltr" className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-8">
            <div dir={locale === "ar" ? "rtl" : "ltr"} className="flex min-w-0 items-center justify-center gap-2.5 text-center sm:gap-3">
              <div className="min-w-0">
                <h1 className="break-words text-sm font-black leading-snug text-foreground sm:text-xl lg:text-2xl">{homeTeamName}</h1>
                {match.isHomeFixture && <span className="mt-1 inline-flex rounded-full bg-club-primary/10 px-2 py-0.5 text-[9px] font-bold text-club-primary">{locale === "ar" ? "نادينا" : "Notre club"}</span>}
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background/70 p-1 sm:h-11 sm:w-11">
                {homeLogoUrl ? <OpponentCrest src={homeLogoUrl} alt="" className="h-full w-full object-contain" iconClassName="h-5 w-5 text-muted-foreground" /> : <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
              </div>
            </div>
            <div className="col-start-2 row-start-1 flex min-w-[66px] flex-col items-center justify-center rounded-xl border border-border bg-muted/40 px-2.5 py-2 sm:min-w-[92px] sm:px-4 sm:py-3">
              <span dir="ltr" className="whitespace-nowrap font-mono text-base font-black tabular-nums text-foreground sm:text-2xl">
                {match.homeScore != null && match.awayScore != null ? `${match.homeScore} – ${match.awayScore}` : locale === "ar" ? "ضد" : "VS"}
              </span>
              {match.status === "LIVE" && <MatchLiveClock matchDate={match.matchDate} hasExtraTime={match.hasExtraTime} hasPenaltyShootout={match.hasPenaltyShootout} homeScore={match.homeScore} awayScore={match.awayScore} addedTime={addedTime} locale={locale} />}
              {match.status !== "LIVE" && <span className="mt-0.5 text-[9px] font-semibold text-muted-foreground">{new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-FR", { hour: "2-digit", minute: "2-digit" }).format(match.matchDate)}</span>}
            </div>
            <div dir={locale === "ar" ? "rtl" : "ltr"} className="flex min-w-0 items-center justify-center gap-2.5 text-center sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background/70 p-1 sm:h-11 sm:w-11">
                {awayLogoUrl ? <OpponentCrest src={awayLogoUrl} alt="" className="h-full w-full object-contain" iconClassName="h-5 w-5 text-muted-foreground" /> : <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <h1 className="break-words text-sm font-black leading-snug text-foreground sm:text-xl lg:text-2xl">{awayTeamName}</h1>
                {!match.isHomeFixture && <span className="mt-1 inline-flex rounded-full bg-club-primary/10 px-2 py-0.5 text-[9px] font-bold text-club-primary">{locale === "ar" ? "نادينا" : "Notre club"}</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 border-t border-border/70 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/25 px-3 py-2.5 text-xs text-muted-foreground">
              <CalendarDays className="h-4 w-4 shrink-0 text-club-primary" aria-hidden="true" />
              <span className="truncate">{new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(match.matchDate)}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/25 px-3 py-2.5 text-xs text-muted-foreground">
              <Trophy className="h-4 w-4 shrink-0 text-club-primary" aria-hidden="true" />
              <span className="truncate">{locale === "ar" ? match.competition.name : frenchCompetitionName(match.competition.name)}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/25 px-3 py-2.5 text-xs text-muted-foreground sm:col-span-2 lg:col-span-1">
              <MapPin className="h-4 w-4 shrink-0 text-club-primary" aria-hidden="true" />
              <span className="truncate">{match.stadium || (locale === "ar" ? "الملعب غير محدد" : "Stade non défini")}</span>
            </div>
          </div>

          {refereeNames.length > 0 && (
            <div className="space-y-2 border-t border-border/70 pt-4">
              <p className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground"><UserCheck className="h-4 w-4 text-club-primary" aria-hidden="true" />{locale === "ar" ? "طاقم التحكيم" : "Équipe arbitrale"}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {refereeNames.map((name, index) => (
                  <div key={`${index}-${name}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2.5 text-xs">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-club-primary/10 text-[10px] font-black text-club-primary">{index + 1}</span>
                    <span className="shrink-0 text-muted-foreground">{getRefereeRoleLabel(index, locale)}</span>
                    <span className="min-w-0 truncate font-semibold text-foreground">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(winnerName || resultNeedsShootout || matchIsDraw) && (
            <div className={`flex flex-wrap items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold ${winnerName ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
              <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{winnerName
                ? `${locale === "ar" ? "الفائز" : "Vainqueur"}: ${winnerName}`
                : resultNeedsShootout
                  ? (locale === "ar" ? "ركلات الترجيح لم تحسم بعد" : "Séance de tirs au but non départagée")
                  : (locale === "ar" ? "انتهت المباراة بالتعادل" : "Match nul")}</span>
              {winnerName && resolvedResult.decidedByPenalties && (
                <span dir="ltr" className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono tabular-nums">
                  {locale === "ar" ? "ترجيح" : "TAB"} {resolvedResult.homePenaltyScore}–{resolvedResult.awayPenaltyScore}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      <MatchManagementTabs
        ariaLabel={locale === "ar" ? "التنقل في إدارة المباراة" : "Navigation de gestion du match"}
        tabs={managementTabs}
      />

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-5 2xl:gap-6">
      <details id="match-data" open className="group min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 xl:col-span-2">
        <summary className="mb-5 flex cursor-pointer list-none items-center justify-between border-b border-border/70 pb-4 marker:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground">{locale === "ar" ? "بيانات المباراة وأوقاتها" : "Données et périodes du match"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "الفريق والمسابقة والخصم وموعد المباراة" : "Équipe, compétition, adversaire et horaire"}</p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </span>
        </summary>
      <ActionFeedbackForm id="match-edit-form" action={update} successMessage={locale === "ar" ? "تم حفظ بيانات المباراة" : "Les données du match ont été enregistrées"} errorMessage={locale === "ar" ? "تعذر حفظ المباراة. تحقق من البيانات ثم أعد المحاولة." : "Impossible d’enregistrer le match. Vérifiez les données puis réessayez."} refreshOnSuccess className="grid w-full min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-2 2xl:gap-6">
        <section className="min-w-0 space-y-4 rounded-2xl border border-border/70 bg-muted/15 p-4 sm:p-5 xl:row-start-1 xl:col-start-1">
          <div className="flex items-center gap-3 border-b border-border/60 pb-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary"><Trophy className="h-4 w-4" aria-hidden="true" /></span>
            <div>
              <h3 className="text-sm font-bold text-foreground">{locale === "ar" ? "الفرق والمسابقة" : "Équipes et compétition"}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{locale === "ar" ? "حدد الفئة والمسابقة والفريق المنافس" : "Choisissez la catégorie, la compétition et l’adversaire"}</p>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{tTeams("title")}</label>
              <FormSelect
                name="teamId"
                defaultValue={match.teamId ?? ""}
                disabled={!canUpdate}
                locale={locale}
                ariaLabel={tTeams("title")}
                options={teams.map((tm) => ({ value: tm.id, label: tTeams(`categories.${tm.category}` as any) }))}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{t("fields.competition")}</label>
              <FormSelect
                name="competitionId"
                defaultValue={match.competitionId}
                disabled={!canUpdate}
                locale={locale}
                ariaLabel={t("fields.competition")}
                options={competitions.map((c) => ({ value: c.id, label: locale === "ar" ? c.name : frenchCompetitionName(c.name) }))}
              />
            </div>
          </div>
        </section>

        <section className="min-w-0 space-y-4 rounded-2xl border border-border/70 bg-muted/15 p-4 sm:p-5 xl:row-start-1 xl:col-start-2">
          <div className="flex items-center gap-3 border-b border-border/60 pb-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500"><Shield className="h-4 w-4" aria-hidden="true" /></span>
            <div>
              <h3 className="text-sm font-bold text-foreground">{locale === "ar" ? "الفريق المنافس" : "Équipe adverse"}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{locale === "ar" ? "أدخل الاسم باللغتين وأضف الشعار إن توفر" : "Saisissez le nom dans les deux langues et ajoutez son logo"}</p>
            </div>
          </div>
          <OpponentNameInputs
            key={`${match.id}:${opponentStoredName}`}
            arabicId="match-opponent-ar"
            frenchId="match-opponent-fr"
            arabicLabel={locale === "ar" ? "اسم الفريق الخصم بالعربية" : "Nom arabe de l’équipe adverse"}
            frenchLabel={locale === "ar" ? "اسم الفريق الخصم بالفرنسية" : "Nom français de l’équipe adverse"}
            arabicValue={opponent}
            frenchValue={opponentNames.fr}
            disabled={!canUpdate}
            arabicClassName="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            frenchClassName="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
          <div className={`${IMAGE_UPLOAD_FRAME} p-4`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className={`${IMAGE_UPLOAD_PREVIEW} relative h-14 w-14 rounded-2xl shadow-xs`}>
                  {opponentLogo ? (
                    <OpponentCrest src={opponentLogo} className="h-full w-full object-contain p-1.5" iconClassName="h-7 w-7 text-muted-foreground" />
                  ) : (
                    <Shield className="h-7 w-7 text-muted-foreground/40" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{locale === "ar" ? "شعار الفريق الخصم" : "Logo de l’équipe adverse"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {opponentLogo
                      ? (locale === "ar" ? "الشعار الحالي محفوظ؛ ارفع صورة جديدة لتغييره" : "Logo actuel enregistré ; téléversez une nouvelle image pour le remplacer.")
                      : (locale === "ar" ? "ارفع شعار الخصم ليظهر في بطاقة المباراة والموقع العام" : "Ajoutez le logo adverse pour l’afficher sur le match et le site public.")}
                  </p>
                </div>
              </div>
              {canUpdate && (
                <label className={`${IMAGE_UPLOAD_ACTION} shrink-0 cursor-pointer`}>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span>{locale === "ar" ? (opponentLogo ? "تغيير الشعار (PNG/JPG)" : "رفع الشعار (PNG/JPG)") : (opponentLogo ? "Changer le logo" : "Téléverser le logo")}</span>
                  <input type="file" name="opponentLogoFile" accept="image/png,image/jpeg,image/webp" className="sr-only" />
                </label>
              )}
            </div>
          </div>
        </section>

        <section className="min-w-0 space-y-4 rounded-2xl border border-border/70 bg-muted/15 p-4 sm:p-5 xl:col-span-2 xl:row-start-2">
          <div className="flex items-center gap-3 border-b border-border/60 pb-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><CalendarDays className="h-4 w-4" aria-hidden="true" /></span>
            <div>
              <h3 className="text-sm font-bold text-foreground">{locale === "ar" ? "الموعد والمكان والحالة" : "Horaire, lieu et statut"}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{locale === "ar" ? "حدد الملعب وتوقيت البداية وحالة المباراة" : "Définissez le stade, l’heure de début et le statut"}</p>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-2">
            <MatchEditFixtureFields initialIsHome={match.isHomeFixture} initialStadium={match.stadium ?? ""} canUpdate={canUpdate} locale={locale} stadiumLabel={t("fields.stadium")} />
            <MatchEditStatusFields
              matchId={match.id}
              locale={locale}
              initialStatus={match.status}
              initialMatchDate={match.matchDate}
              canUpdate={canUpdate}
              statusLabel={tCommon("status")}
              dateLabel={t("fields.matchDate")}
              statuses={[
                { value: "SCHEDULED", label: t("statuses.SCHEDULED") },
                { value: "STARTING_SOON", label: locale === "ar" ? "تبدأ قريباً" : "Débute bientôt" },
                ...["LIVE", "FINISHED", "POSTPONED"].map((s) => ({ value: s, label: t(`statuses.${s}` as any) }))
              ]}
            />
            <MatchPeriodOptions
              locale={locale}
              initialExtraTime={match.hasExtraTime}
              initialShootout={match.hasPenaltyShootout}
              addedTime={{
                firstHalf: match.firstHalfAddedTime,
                secondHalf: match.secondHalfAddedTime,
                extraTimeFirstHalf: match.extraTimeFirstHalfAddedTime,
                extraTimeSecondHalf: match.extraTimeSecondHalfAddedTime
              }}
              disabled={!canUpdate}
            />
            <details className="group rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4 2xl:col-span-2">
              <summary className="flex cursor-pointer list-none items-center gap-2 marker:hidden">
                <CalendarDays className="h-4 w-4 shrink-0 text-sky-500" aria-hidden="true" />
                <h4 className="text-xs font-bold text-foreground">{locale === "ar" ? "كيف تتغير حالة المباراة؟" : "Évolution du statut du match"}</h4>
                <ChevronDown className="ms-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-sky-500/15 pt-3 sm:grid-cols-2 2xl:grid-cols-5">
                {[
                  { title: locale === "ar" ? "مبرمجة" : "Programmée", detail: locale === "ar" ? "الحالة قبل اقتراب موعد البداية." : "Avant l’approche du coup d’envoi.", tone: "border-sky-500/20 bg-sky-500/5 text-sky-700 dark:text-sky-300" },
                  { title: locale === "ar" ? "تبدأ قريباً" : "Débute bientôt", detail: locale === "ar" ? "تظهر قبل البداية بنصف ساعة." : "S’affiche 30 minutes avant le début.", tone: "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300" },
                  { title: locale === "ar" ? "مباشر" : "En direct", detail: locale === "ar" ? "تبدأ عند موعد انطلاق المباراة." : "Passe en direct à l’heure du match.", tone: "border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-300" },
                  { title: locale === "ar" ? "انتهت" : "Terminée", detail: locale === "ar" ? "تُنهى تلقائياً بعد اكتمال الوقت وحسم الترجيح." : "Se termine automatiquement après le temps de jeu et la séance de tirs au but.", tone: "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" },
                  { title: locale === "ar" ? "مؤجلة" : "Reportée", detail: locale === "ar" ? "تبقى مؤجلة حتى يغيّرها الإداري." : "Reste reportée jusqu’à sa modification par l’administrateur.", tone: "border-border bg-background/70 text-muted-foreground" }
                ].map((item) => (
                  <div key={item.title} className={`min-w-0 rounded-lg border px-3 py-2.5 ${item.tone}`}>
                    <p className="text-xs font-bold">{item.title}</p>
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </section>

        <section className="min-w-0 space-y-5 rounded-2xl border border-border/70 bg-muted/15 p-4 sm:p-5 xl:col-span-2">
          <div className="flex items-center gap-3 border-b border-border/60 pb-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"><Target className="h-4 w-4" aria-hidden="true" /></span>
            <div>
              <h3 className="text-sm font-bold text-foreground">{locale === "ar" ? "الطاقم التحكيمي وتقرير المباراة" : "Arbitrage et compte rendu"}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{locale === "ar" ? "أدخل أسماء الحكام باللغتين، ثم أضف تقرير المباراة عند الحاجة" : "Saisissez les arbitres dans les deux langues, puis ajoutez le compte rendu si nécessaire"}</p>
            </div>
          </div>
          <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <section className="min-w-0 rounded-2xl border border-border/70 bg-background/50 p-4 sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{t("fields.refereeName")}</h4>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{locale === "ar" ? "رتّب الأسماء: الحكم الرئيسي، ثم حكما التماس. اضغط Enter بعد كل اسم." : "Ordre : arbitre principal, puis les deux assistants. Appuyez sur Entrée après chaque nom."}</p>
                </div>
                <span className="shrink-0 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">3 {locale === "ar" ? "حكام كحد أقصى" : "max."}</span>
              </div>
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <div className="min-w-0 rounded-xl border border-border/60 bg-card/70 p-3">
                  <p className="mb-2 text-xs font-bold text-foreground">{locale === "ar" ? "العربية" : "Arabe"}</p>
                  <RefereeNamesInput name="refereeNameAr" defaultValue={arabicRefereeNames(match.refereeNameAr, match.refereeNameFr, match.refereeName)} locale={locale} nameDirection="rtl" disabled={!canUpdate} showOrderHint={false} />
                </div>
                <div className="min-w-0 rounded-xl border border-border/60 bg-card/70 p-3">
                  <p className="mb-2 text-xs font-bold text-foreground">{locale === "ar" ? "الفرنسية" : "Français"}</p>
                  <RefereeNamesInput name="refereeNameFr" defaultValue={match.refereeNameFr} locale={locale} nameDirection="ltr" disabled={!canUpdate} showOrderHint={false} />
                </div>
              </div>
            </section>
            <div className="min-w-0 rounded-2xl border border-border/70 bg-background/50 p-4 sm:p-5">
              <label htmlFor="match-report" className="block text-sm font-bold text-foreground">{t("fields.matchReport")}</label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{locale === "ar" ? "دوّن ملخصاً أو ملاحظات رسمية عن المباراة." : "Ajoutez un résumé ou des notes officielles sur le match."}</p>
              <textarea
                id="match-report"
                name="matchReport"
                rows={7}
                defaultValue={match.matchReport ?? ""}
                disabled={!canUpdate}
                placeholder={locale === "ar" ? "اكتب تقرير المباراة هنا…" : "Rédigez le compte rendu ici…"}
                className="mt-4 min-h-44 w-full resize-y rounded-xl border border-border bg-card px-3.5 py-3 text-sm leading-6 text-foreground transition-colors placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>
          </div>
        </section>
      </ActionFeedbackForm>
      </details>

      {/* Lineup */}
      <details id="match-lineup" open={canManageLineup} className="group h-full min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <summary className="mb-5 flex min-h-[88px] cursor-pointer list-none items-center justify-between gap-4 border-b border-border/70 pb-4 marker:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <UserCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-foreground">{t("lineup.title")}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{locale === "ar" ? `تُملأ القائمة من وثيقة FAF: الأساسيون والاحتياط، والباقون غير مدعوين. حدّد المصابين يدويًا؛ ويُحسب الإيقاف من البطاقة الحمراء في آخر مباراة سابقة ضمن المسابقة نفسها.${matchTeamCategory === "SENIOR" ? " لاعبو U20 متاحون أيضًا لتشكيلة الأكابر." : ""}` : `La feuille FAF renseigne les titulaires et les remplaçants ; les autres joueurs sont non convoqués. Saisissez les blessures manuellement. Une expulsion au dernier match précédent de cette compétition entraîne une suspension.${matchTeamCategory === "SENIOR" ? " Les joueurs U20 sont aussi disponibles avec les seniors." : ""}`}</p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </span>
        </summary>
        <MatchLineupWorkspace
          matchId={match.id}
          locale={locale}
          players={trackedPlayers.map((player) => ({
            id: player.id,
            firstName: player.firstName,
            lastName: player.lastName,
            firstNameFr: player.firstNameFr,
            lastNameFr: player.lastNameFr,
            photoUrl: player.photoUrl,
            shirtNumber: player.shirtNumber,
            position: player.position,
            status: player.status
          }))}
          lineups={match.lineups.map((lineup) => ({
            playerId: lineup.playerId,
            isCaptain: lineup.isCaptain,
            isStarting: lineup.isStarting,
            selectionStatus: lineup.selectionStatus,
            position: lineup.position,
            shirtNumber: lineup.shirtNumber
          }))}
          autoSuspendedPlayerIds={Array.from(previousRedCardPlayerIds)}
          canEdit={canManageLineup}
          fetchFafLineup={canManageLineup ? <FafEmsSyncButton matchId={match.id} locale={locale} buttonLabel={locale === "ar" ? "جلب التشكيلة من FAF EMS" : "Importer la composition FAF EMS"} /> : null}
          saveEntry={addLineupEntry}
          removeEntry={removeLineupPlayer}
          swapPositions={swapLineupPositions}
          syncAutomaticSuspensions={syncLineupSuspensions}
        />

      </details>


{/* ---------------------------------- Match documents */}
      <details id="match-documents" open={showRefereeReport} className="group h-full min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <summary className="mb-5 flex min-h-[88px] cursor-pointer list-none items-center justify-between gap-4 border-b border-border/70 pb-4 marker:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="text-base font-bold leading-tight text-foreground">
                  {locale === "ar" ? "وثائق المباراة المحفوظة" : "Documents enregistrés du match"}
                </h2>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                {locale === "ar"
                  ? "اجلب وثيقة بداية المباراة والتقرير النهائي ومجريات اللقاء من سجل Historique في حساب النادي على FAF EMS مباشرة إلى المنصة."
                  : "Importez ici la feuille de début, le rapport final et les événements depuis l’Historique FAF EMS du club."}
              </p>
            </div>
          </div>

          <span className="flex shrink-0 items-center gap-2">
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </span>
        </summary>
        {canReport && <div className="mb-4 flex justify-end"><FafEmsSyncButton matchId={match.id} locale={locale} /></div>}
        <div className="space-y-6">

        {/* 1. Pre-Match Lineup Sheet Card */}
        <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-foreground">
                {locale === "ar" ? "1. ورقة التشكيل قبل المباراة" : "1. Feuille de composition avant match"}
              </h3>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {locale === "ar" ? "ارفع الورقة الرسمية، ويمكن استخراج اللاعبين منها تلقائياً." : "Déposez la feuille officielle et extrayez automatiquement les joueurs."}
              </p>
            </div>
            {preMatchSheet ? (
              <Badge tone={preMatchSheet.status === "APPROVED" ? "success" : "warning"} className="gap-1 text-[11px]">
                <span>{preMatchSheet.status === "APPROVED"
                  ? locale === "ar" ? "مراجعة داخلياً" : "Vérifiée en interne"
                  : locale === "ar" ? "مرفوعة، بانتظار المراجعة" : "Téléversée, en attente de revue"}</span>
              </Badge>
            ) : (
              <Badge tone="warning" className="text-[11px]">
                {locale === "ar" ? "بانتظار الرفع" : "Non transmise"}
              </Badge>
            )}
          </div>

          {preMatchSheet ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-2xs">
              <div>
                <p className="font-semibold text-xs text-foreground">{preMatchSheet.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {preMatchSheet.originalName} • {(preMatchSheet.sizeBytes / 1024).toFixed(1)} KB • {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(preMatchSheet.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <DocumentPreviewModal
                  documentId={preMatchSheet.id}
                  title={preMatchSheet.name}
                  fileName={preMatchSheet.originalName}
                  mimeType={preMatchSheet.mimeType}
                  locale={locale}
                  buttonLabel={locale === "ar" ? "معاينة الورقة" : "Aperçu"}
                />
                <a
                  href={`/api/documents/${preMatchSheet.id}/download`}
                  download
                  className="inline-flex items-center gap-1 rounded-md bg-club-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-club-primary/90 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "تحميل" : "Télécharger"}</span>
                </a>
              </div>
            </div>
          ) : null}

          {canReport && (
          <PreMatchSheetUploadGate status={match.status} locale={locale}>
          <ActionFeedbackForm action={attachSheet} successMessage={locale === "ar" ? "تم رفع ورقة المباراة بنجاح" : "La feuille du match a été téléversée"} errorMessage={locale === "ar" ? "تعذر رفع الوثيقة. تحقق من الملف ثم أعد المحاولة." : "Impossible de téléverser le document. Vérifiez le fichier puis réessayez."} refreshOnSuccess className="grid min-w-0 grid-cols-1 items-center gap-2 2xl:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input type="hidden" name="sheetType" value="PRE_MATCH_SHEET" />
              <input type="hidden" name="locale" value={locale} />
              <DocumentUploadPicker
                  name="sheetFile"
                  locale={locale}
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  label={locale === "ar" ? "اختيار الوثيقة" : "Choisir le document"}
                  emptyLabel={locale === "ar" ? "لم يتم اختيار ملف" : "Aucun fichier sélectionné"}
                />
                <label title={locale === "ar" ? "تحديد الأساسيين والاحتياطيين من الورقة" : "Identifier titulaires et remplaçants"} className="group relative flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-start transition-all hover:border-club-primary/50 hover:bg-club-primary/5 has-[:checked]:border-club-primary/60 has-[:checked]:bg-club-primary/10">
                  <input type="hidden" name="autoLineup" value="false" />
                  <input name="autoLineup" value="true" type="checkbox" defaultChecked className="peer sr-only" />
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-muted-foreground transition-colors peer-checked:border-club-primary peer-checked:bg-club-primary peer-checked:text-white">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                  </span>
                  <span className="whitespace-nowrap text-[11px] font-bold text-foreground">
                    {locale === "ar" ? "استخراج تلقائي" : "Extraction auto"}
                  </span>
                </label>
                <Button type="submit" size="sm" className="h-8 min-h-8 shrink-0 gap-1.5 rounded-md px-3 text-xs">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "رفع الورقة" : "Déposer"}</span>
                </Button>
            </ActionFeedbackForm>
          </PreMatchSheetUploadGate>
          )}
        </div>

        {/* 2. Post-Match Referee Report Card */}
        {showRefereeReport && (
        <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-foreground">
                {locale === "ar" ? "2. تقرير حكم اللقاء بعد المباراة" : "2. Rapport d'arbitrage après match"}
              </h3>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {locale === "ar" ? "يجلب التقرير والنتيجة والأحداث مباشرة من FAF EMS عبر زر الجلب أعلى الصفحة." : "Le rapport, le score et les événements sont importés directement depuis FAF EMS avec le bouton en haut de page."}
              </p>
            </div>
            {refereeReport ? (
              <Badge tone={refereeReport.status === "APPROVED" ? "success" : "warning"} className="gap-1 text-[11px]">
                <span>{refereeReport.status === "APPROVED"
                  ? locale === "ar" ? "مراجعة داخلية" : "Vérifié en interne"
                  : locale === "ar" ? "مرفوع، بانتظار المراجعة" : "Téléversé, en attente de revue"}</span>
              </Badge>
            ) : (
              <Badge tone="neutral" className="text-[11px]">
                {locale === "ar" ? "بانتظار تقرير الحكم" : "En attente du rapport"}
              </Badge>
            )}
          </div>

          {refereeReport ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-2xs">
              <div>
                <p className="font-semibold text-xs text-foreground">{refereeReport.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {refereeReport.originalName} • {(refereeReport.sizeBytes / 1024).toFixed(1)} KB • {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(refereeReport.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DocumentPreviewModal
                  documentId={refereeReport.id}
                  title={refereeReport.name}
                  fileName={refereeReport.originalName}
                  mimeType={refereeReport.mimeType}
                  locale={locale}
                  buttonLabel={locale === "ar" ? "معاينة التقرير" : "Aperçu"}
                  className="h-8 min-h-8 shrink-0 rounded-md px-3"
                />
                <a
                  href={`/api/documents/${refereeReport.id}/download`}
                  download
                  className="inline-flex h-8 min-h-8 shrink-0 items-center gap-1 rounded-md bg-club-primary px-3 text-xs font-medium text-white transition-colors hover:bg-club-primary/90"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "تحميل" : "Télécharger"}</span>
                </a>
              </div>
            </div>
          ) : null}

        </div>
        )}
        </div>
      </details>

      {/* Match events */}
      <details id="match-events" open={match.status === "LIVE"} className="group min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 xl:col-span-2">
        <summary className="mb-5 flex cursor-pointer list-none items-center justify-between border-b border-border/70 pb-4 marker:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Target className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground">{t("events.title")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "سجّل الأهداف والبطاقات أثناء المباراة المباشرة." : "Enregistrez les buts et sanctions pendant le direct."}</p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </span>
        </summary>
        {(() => {
          let runningHome = 0;
          let runningAway = 0;
          let halfTimeScore = "0 - 0";
          const scoreAfter = new Map<string, string>();
          for (const display of displayedEvents) {
            const event = display.kind === "SUBSTITUTION" ? display.incoming : display.event;
            if (["GOAL", "PENALTY_GOAL", "OWN_GOAL"].includes(event.type)) {
              const scoringSide = event.type === "OWN_GOAL" ? event.side === "HOME" ? "AWAY" : "HOME" : event.side;
              if (scoringSide === "HOME") runningHome += 1;
              else runningAway += 1;
              scoreAfter.set(display.id, `${runningHome} - ${runningAway}`);
            }
            if (event.minute <= 45) halfTimeScore = `${runningHome} - ${runningAway}`;
          }
          const firstSecondHalfEvent = displayedEvents.findIndex((display) => (display.kind === "SUBSTITUTION" ? display.minute : display.event.minute) > 45);
          const showHalfTime = match.status === "LIVE" || match.status === "FINISHED";
          return <ul dir="ltr" className="mb-5 overflow-hidden rounded-2xl border border-border/70 bg-muted/10 px-3 py-4 sm:px-6">
          <li className="mb-4 text-center text-xs font-bold tracking-wide text-muted-foreground">{locale === "ar" ? "أحداث المباراة" : "ÉVÉNEMENTS DU MATCH"}</li>
          {displayedEvents.map((display, index) => {
            const isSubstitution = display.kind === "SUBSTITUTION";
            const e = isSubstitution ? display.incoming : display.event;
            const eventGroup = isSubstitution ? [display.outgoing, display.incoming] : [e];
            const homeSide = e.side === "HOME";
            const isGoal = ["GOAL", "PENALTY_GOAL", "OWN_GOAL"].includes(e.type);
            const playerName = e.player
              ? locale === "fr" ? [e.player.firstNameFr, e.player.lastNameFr].filter(Boolean).join(" ") || `${e.player.firstName} ${e.player.lastName}` : `${e.player.firstName} ${e.player.lastName}`
              : e.playerName ? locale === "fr" ? e.playerNameFr || "Joueur" : e.playerName
                : e.staff ? getPlayerDisplayName(e.staff, locale) : "";
            const assistName = e.shot?.assistPlayer
              ? locale === "fr" ? [e.shot.assistPlayer.firstNameFr, e.shot.assistPlayer.lastNameFr].filter(Boolean).join(" ") || `${e.shot.assistPlayer.firstName} ${e.shot.assistPlayer.lastName}` : `${e.shot.assistPlayer.firstName} ${e.shot.assistPlayer.lastName}`
              : "";
            async function updateEvent(formData: FormData) {
              "use server";
              await updateMatchEventAction(id, e.id, formData);
            }
            async function removeEvent() {
              "use server";
              for (const groupedEvent of eventGroup) await deleteMatchEventAction(id, groupedEvent.id);
            }
            return (
              <Fragment key={display.id}>
                {showHalfTime && index === (firstSecondHalfEvent === -1 ? displayedEvents.length : firstSecondHalfEvent) && <li className="my-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><span className="h-px bg-border" /><span className="rounded-full border border-border bg-card px-3 py-1 text-[10px] font-extrabold text-foreground">{locale === "ar" ? `نهاية الشوط الأول · ${halfTimeScore}` : `MI-TEMPS · ${halfTimeScore}`}{match.firstHalfAddedTime > 0 ? ` · +${match.firstHalfAddedTime}′` : ""}</span><span className="h-px bg-border" /></li>}
                <li className="grid grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)] items-center gap-1.5 py-2 sm:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)] sm:gap-3">
                  <div className={`min-w-0 ${homeSide ? "text-end" : "invisible"}`} dir={locale === "ar" ? "rtl" : "ltr"}>
                    {homeSide && (isSubstitution ? <><p className="truncate text-xs font-bold text-emerald-600 dark:text-emerald-400">{e.player ? `${e.player.firstName} ${e.player.lastName}` : e.playerName || "—"}</p><p className="truncate text-[10px] text-rose-500">{display.outgoing.player ? `${display.outgoing.player.firstName} ${display.outgoing.player.lastName}` : display.outgoing.playerName || "—"}</p><p className="text-[9px] text-muted-foreground">{locale === "ar" ? "تبديل" : "Remplacement"}</p></> : <>
                      <p className={`flex items-center justify-end gap-1.5 truncate text-[11px] font-bold ${isGoal ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                        {e.type === "GOAL" || e.type === "OWN_GOAL" ? <Target className="h-3 w-3 shrink-0 text-emerald-500" /> : null}
                        {e.type === "PENALTY_GOAL" ? <CircleDot className="h-3 w-3 shrink-0 text-emerald-500" /> : null}
                        {e.type === "PENALTY_MISSED" ? <CircleX className="h-3 w-3 shrink-0 text-red-500" /> : null}
                        {e.type === "YELLOW_CARD" ? <Square className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-500" /> : null}
                        {e.type === "RED_CARD" ? <Square className="h-3 w-3 shrink-0 fill-red-500 text-red-600" /> : null}
                        <span className="truncate">{playerName || t(`events.${e.type}` as any)}{isGoal && scoreAfter.has(display.id) ? ` (${scoreAfter.get(display.id)})` : ""}</span>
                      </p>
                      <p className="truncate text-[9px] text-muted-foreground">{assistName ? `${locale === "ar" ? "صناعة" : "Passe décisive"}: ${assistName}` : t(`events.${e.type}` as any)}{e.source === "REFEREE_REPORT" ? ` · ${locale === "ar" ? "تقرير الحكم" : "Rapport arbitral"}` : ""}</p>
                    </>)}
                  </div>
                  <span className="relative z-10 mx-auto inline-flex h-8 min-w-10 items-center justify-center rounded-full border border-border bg-background px-1.5 font-mono text-[10px] font-extrabold text-foreground shadow-sm sm:h-9 sm:min-w-11">{e.minute}&apos;</span>
                  <div className={`min-w-0 ${!homeSide ? "text-start" : "invisible"}`} dir={locale === "ar" ? "rtl" : "ltr"}>
                    {!homeSide && (isSubstitution ? <><p className="truncate text-xs font-bold text-emerald-600 dark:text-emerald-400">{e.player ? `${e.player.firstName} ${e.player.lastName}` : e.playerName || "—"}</p><p className="truncate text-[10px] text-rose-500">{display.outgoing.player ? `${display.outgoing.player.firstName} ${display.outgoing.player.lastName}` : display.outgoing.playerName || "—"}</p><p className="text-[9px] text-muted-foreground">{locale === "ar" ? "تبديل" : "Remplacement"}</p></> : <>
                      <p className={`flex items-center gap-1.5 truncate text-[11px] font-bold ${isGoal ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                        {e.type === "GOAL" || e.type === "OWN_GOAL" ? <Target className="h-3 w-3 shrink-0 text-emerald-500" /> : null}
                        {e.type === "PENALTY_GOAL" ? <CircleDot className="h-3 w-3 shrink-0 text-emerald-500" /> : null}
                        {e.type === "PENALTY_MISSED" ? <CircleX className="h-3 w-3 shrink-0 text-red-500" /> : null}
                        {e.type === "YELLOW_CARD" ? <Square className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-500" /> : null}
                        {e.type === "RED_CARD" ? <Square className="h-3 w-3 shrink-0 fill-red-500 text-red-600" /> : null}
                        <span className="truncate">{playerName || t(`events.${e.type}` as any)}{isGoal && scoreAfter.has(display.id) ? ` (${scoreAfter.get(display.id)})` : ""}</span>
                      </p>
                      <p className="truncate text-[9px] text-muted-foreground">{assistName ? `${locale === "ar" ? "صناعة" : "Passe décisive"}: ${assistName}` : t(`events.${e.type}` as any)}{e.source === "REFEREE_REPORT" ? ` · ${locale === "ar" ? "تقرير الحكم" : "Rapport arbitral"}` : ""}</p>
                    </>)}
                  </div>
                  {canReport && <div className="col-span-3 flex justify-center gap-2 pt-1">
                  {!isSubstitution && (match.status === "LIVE" || match.status === "FINISHED") && <MatchEventEditDialog
                    locale={locale}
                    event={{ id: e.id, type: e.type, side: e.side, minute: e.minute, playerId: e.playerId, staffId: e.staffId, playerName: e.playerName, playerNameFr: e.playerNameFr, bodyPart: e.shot?.bodyPart }}
                    homeTeamName={homeTeamName}
                    awayTeamName={awayTeamName}
                    clubSide={match.isHomeFixture ? "HOME" : "AWAY"}
                    eventTypes={EVENT_TYPES.map((type) => ({ value: type, label: t(`events.${type}` as any) }))}
                    players={trackedPlayers.map((player) => ({ id: player.id, label: `${player.firstName} ${player.lastName}` }))}
                    staff={staff.filter((member) => member.teamId === match.teamId).map((member) => ({ id: member.id, label: getPlayerDisplayName(member, locale) }))}
                    action={updateEvent}
                  />}
                  {isSubstitution && eventGroup.map((groupedEvent) => <MatchEventEditDialog key={groupedEvent.id}
                    locale={locale}
                    event={{ id: groupedEvent.id, type: groupedEvent.type, side: groupedEvent.side, minute: groupedEvent.minute, playerId: groupedEvent.playerId, staffId: groupedEvent.staffId, playerName: groupedEvent.playerName, playerNameFr: groupedEvent.playerNameFr, bodyPart: groupedEvent.shot?.bodyPart }}
                    homeTeamName={homeTeamName}
                    awayTeamName={awayTeamName}
                    clubSide={match.isHomeFixture ? "HOME" : "AWAY"}
                    eventTypes={EVENT_TYPES.map((type) => ({ value: type, label: t(`events.${type}` as any) }))}
                    players={trackedPlayers.map((player) => ({ id: player.id, label: `${player.firstName} ${player.lastName}` }))}
                    staff={staff.filter((member) => member.teamId === match.teamId).map((member) => ({ id: member.id, label: getPlayerDisplayName(member, locale) }))}
                    action={async (formData) => { "use server"; await updateMatchEventAction(id, groupedEvent.id, formData); }}
                  />)}
                  <ConfirmDialog onConfirm={removeEvent}>
                    <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{tCommon("delete")}</span>
                    </button>
                  </ConfirmDialog>
                </div>}
                </li>
              </Fragment>
            );
          })}
          {showHalfTime && firstSecondHalfEvent === -1 && <li className="my-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><span className="h-px bg-border" /><span className="rounded-full border border-border bg-card px-3 py-1 text-[10px] font-extrabold text-foreground">{locale === "ar" ? `نهاية الشوط الأول · ${halfTimeScore}` : `MI-TEMPS · ${halfTimeScore}`}{match.firstHalfAddedTime > 0 ? ` · +${match.firstHalfAddedTime}′` : ""}</span><span className="h-px bg-border" /></li>}
          {match.status === "FINISHED" && <li className="my-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><span className="h-px bg-border" /><span className="rounded-full border border-club-primary/25 bg-club-primary/10 px-3 py-1 text-[10px] font-extrabold text-club-primary">{locale === "ar" ? `نهاية المباراة · ${match.homeScore ?? 0} - ${match.awayScore ?? 0}` : `FIN DU MATCH · ${match.homeScore ?? 0} - ${match.awayScore ?? 0}`}{match.secondHalfAddedTime > 0 ? ` · +${match.secondHalfAddedTime}′` : ""}</span><span className="h-px bg-border" /></li>}
          {match.events.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">{tCommon("noResults")}</li>}
        </ul>;
        })()}

        {canReport && match.status === "LIVE" && (
          <MatchEventForm
            action={addEvent}
            locale={locale}
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            clubSide={match.isHomeFixture ? "HOME" : "AWAY"}
            allPlayers={trackedPlayers.filter((player) => player.status === "ACTIVE").map(({ id: playerId, firstName, lastName }) => ({ id: playerId, firstName, lastName }))}
            startingPlayers={startingPlayers.map((lineup) => ({ id: lineup.player.id, firstName: lineup.player.firstName, lastName: lineup.player.lastName }))}
            substitutePlayers={substitutePlayers.map((lineup) => ({ id: lineup.player.id, firstName: lineup.player.firstName, lastName: lineup.player.lastName }))}
            staff={staff.filter((member) => member.teamId === match.teamId).map(({ id: staffId, firstName, lastName }) => ({ id: staffId, firstName, lastName }))}
            eventTypes={EVENT_TYPES.map((type) => ({ value: type, label: t(`events.${type}` as any) }))}
            defaultMinute={liveClock.minute}
            labels={{
              minute: t("events.minute"),
              type: locale === "ar" ? "نوع الحدث" : "Type d’événement",
              side: locale === "ar" ? "فريقنا أو الخصم" : "Notre équipe ou l’adversaire",
              player: locale === "ar" ? "اسم اللاعب" : "Nom du joueur",
              playerName: locale === "ar" ? "اسم لاعب الخصم" : "Nom du joueur adverse",
              playerNameFr: locale === "ar" ? "اسم اللاعب بالفرنسية" : "Nom en français",
              participant: locale === "ar" ? "نوع صاحب الحدث" : "Participant",
              staff: locale === "ar" ? "عضو الطاقم (للبطاقات)" : "Membre du staff (cartons)",
              add: t("events.addEvent"),
              playerPlaceholder: "—",
              playerArabicPlaceholder: "الاسم بالعربية",
              playerFrenchPlaceholder: "Ex. : Karim Benali",
              staffOption: locale === "ar" ? "طاقم" : "Staff"
            }}
            successMessage={locale === "ar" ? "تم تسجيل الحدث" : "L’événement a été enregistré"}
            errorMessage={locale === "ar" ? "تعذر تسجيل الحدث. تحقق من البيانات ثم أعد المحاولة." : "Impossible d’enregistrer l’événement. Vérifiez les données puis réessayez."}
          />
        )}
        {canReport && match.status !== "LIVE" && (
          <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            {locale === "ar" ? "تسجيل الأهداف والبطاقات متاح فقط عندما تكون المباراة مباشرة." : "L’enregistrement des buts et cartons est disponible uniquement lorsque le match est en direct."}
          </p>
        )}
      </details>

      {match.hasPenaltyShootout && (
        <details id="match-shootout" open={shootoutReady} className="group min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 xl:col-span-2">
          <summary className="mb-4 flex cursor-pointer list-none items-center justify-between border-b border-border/70 pb-4 marker:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <CircleDot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-foreground">{locale === "ar" ? "ركلات الترجيح" : "Tirs au but"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "كل ركلة مرتبطة باللاعب ونتيجتها" : "Chaque tir est associé au joueur et à son résultat"}</p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-2">
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
          </summary>
          {match.shootoutKicks.length > 0 ? <div className="mb-4 grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {(["HOME", "AWAY"] as const).map((side) => <div key={side} className="rounded-xl border border-border/70 bg-background/40 p-3">
              <h3 className="mb-2 text-sm font-bold">{side === "HOME" ? homeTeamName : awayTeamName}</h3>
              <ol className="space-y-2">{match.shootoutKicks.filter((kick) => kick.side === side).map((kick) => <li key={kick.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{kick.attemptNumber}. {kick.playerName}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className={kick.result === "SCORED" ? "inline-flex items-center gap-1 text-emerald-500" : "inline-flex items-center gap-1 text-red-500"}>{kick.result === "SCORED" ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}{kick.result === "SCORED" ? (locale === "ar" ? "سجل" : "Marqué") : (locale === "ar" ? "أضاع" : "Manqué")}</span>
                  {canReport && (
                    <ConfirmDialog
                      onConfirm={deleteShootoutKick.bind(null, kick.id)}
                      title={locale === "ar" ? "حذف ركلة الترجيح؟" : "Supprimer ce tir au but ?"}
                      body={locale === "ar" ? `سيتم حذف ركلة ${kick.playerName} وإعادة ترتيب أرقام الركلات.` : `Le tir de ${kick.playerName} sera supprimé et les numéros suivants seront réorganisés.`}
                    >
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={locale === "ar" ? `حذف ركلة ${kick.attemptNumber} للاعب ${kick.playerName}` : `Supprimer le tir ${kick.attemptNumber} de ${kick.playerName}`} title={locale === "ar" ? "حذف الركلة" : "Supprimer le tir"}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </ConfirmDialog>
                  )}
                </span>
              </li>)}</ol>
            </div>)}
          </div> : <p className="mb-4 text-sm text-muted-foreground">{locale === "ar" ? "لم تسجل أي ركلة بعد." : "Aucun tir enregistré."}</p>}
          {!shootoutReady && <p className="mb-4 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            {match.status !== "LIVE"
              ? (locale === "ar" ? "ستُتاح خانات التسجيل عند بدء المباراة والوصول إلى ركلات الترجيح." : "La saisie sera disponible lorsque le match atteindra la séance de tirs au but.")
              : (locale === "ar" ? "تُسجل الركلات بعد نهاية الوقت الأصلي والإضافي، عند استمرار التعادل." : "Les tirs sont enregistrés après le temps réglementaire et les prolongations si l’égalité persiste.")}
          </p>}
          {canReport && <ActionFeedbackForm action={addShootoutKick} successMessage={locale === "ar" ? "تم تسجيل ركلة الترجيح" : "Le tir au but a été enregistré"} errorMessage={locale === "ar" ? "تعذر تسجيل الركلة. تحقق من البيانات ثم أعد المحاولة." : "Impossible d’enregistrer le tir. Vérifiez les données puis réessayez."}>
            <ShootoutKickForm available={shootoutReady} locale={locale} homeTeamName={homeTeamName} awayTeamName={awayTeamName} clubSide={match.isHomeFixture ? "HOME" : "AWAY"} players={trackedPlayers.filter((player) => player.status === "ACTIVE").map(({ id, firstName, lastName }) => ({ id, firstName, lastName }))} />
          </ActionFeedbackForm>}
        </details>
      )}
      </div>

      {(canUpdate || canDelete) && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
          {canUpdate && (
            <Button type="submit" form="match-edit-form" className="h-10 gap-2 rounded-xl px-4 font-bold shadow-sm">
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>{tCommon("save")}</span>
            </Button>
          )}
          {canDelete && (
            <ConfirmDialog onConfirm={remove}>
              <Button variant="destructive" className="h-10 gap-2 rounded-xl px-4 font-bold shadow-sm">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>{tCommon("delete")}</span>
              </Button>
            </ConfirmDialog>
          )}
        </div>
      )}
    </div>
  );
}
