import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { notFound } from "next/navigation";
import { updatePlayerAction, archivePlayerAction, restorePlayerAction, hardDeletePlayerAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { NoticeToast } from "@/components/shared/notice-toast";
import { birthYearMismatch } from "@/lib/utils";
import { PlayerPageFreshness } from "@/components/players/player-page-freshness";

import { resolveUserTeamContext } from "@/lib/team-context";
import { PlayerPerformanceCard, type ProtocolPerformanceGroup } from "@/components/testing/player-performance-card";
import { analyzePlayerHistory } from "@/lib/testing/history-analyzer";
import { DocumentUploadField } from "@/components/dashboard/document-upload-field";
import { PlayerPhotoEditor } from "@/components/dashboard/player-photo-editor";
import { PlayerField as Field } from "@/components/players/player-field";
import { PlayerAttendanceCard } from "@/components/training/player-attendance-card";
import { evaluatePlayerInsurance, parseInsuranceMetadata, formatInsuranceDate } from "@/lib/documents/insurance-helper";
import { OfficialPlayerAttestationModal } from "@/components/players/official-player-attestation-modal";
import { DateInput } from "@/components/ui/date-input";
import { FormSelect } from "@/components/ui/form-select";
import { BloodGroupField } from "@/components/players/blood-group-field";
import { Save, Trash2, Archive, RotateCcw, ShieldCheck, ShieldAlert, Clock, XCircle, User, Shield, Activity, FileText, UserCheck, Calendar, MapPin, Hash, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { arabicNationality, frenchNationality } from "@/lib/public/locale-text";

const POSITIONS = ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"] as const;
const STATUSES = ["ACTIVE", "INJURED", "SUSPENDED", "ON_LOAN", "ARCHIVED"] as const;

export default async function PlayerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<{ notice?: string }>;
}) {
  const { locale, id } = await params;
  const { notice } = (await searchParams) ?? {};
  const user = await requirePagePermission("players.view", locale);
  const t = await getTranslations("players");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  // Load the record needed by the edit form independently from optional
  // history panels. A broken/stale testing or attendance table must not make
  // the core player record impossible to edit.
  const playerRecord = await db.player.findUnique({ where: { id } });
  if (!playerRecord) notFound();

  const [{ authorizedTeams }, scopeContext] = await Promise.all([
    resolveUserTeamContext(),
    getMutationScopeContext()
  ]);

  try {
    assertTeamScope(scopeContext, playerRecord.teamId, "Player", { allowClubWide: true });
  } catch {
    notFound();
  }

  // Keep ancillary relations out of the critical record query. This also
  // makes legacy databases with incomplete optional tables diagnosable
  // without taking down the player edit form.
  const [translationsResult, contractsResult, documentsResult, teamResult] = await Promise.allSettled([
    db.playerTranslation.findMany({ where: { playerId: id } }),
    db.contract.findMany({ where: { playerId: id } }),
    db.document.findMany({ where: { relatedPlayerId: id, medicalRecord: null } }),
    playerRecord.teamId ? db.team.findUnique({ where: { id: playerRecord.teamId } }) : Promise.resolve(null)
  ]);
  const player = {
    ...playerRecord,
    translations: translationsResult.status === "fulfilled" ? translationsResult.value : [],
    contracts: contractsResult.status === "fulfilled" ? contractsResult.value : [],
    documents: documentsResult.status === "fulfilled" ? documentsResult.value : [],
    team: teamResult.status === "fulfilled" ? teamResult.value : null
  };
  for (const [relation, result] of [
    ["translations", translationsResult],
    ["contracts", contractsResult],
    ["documents", documentsResult],
    ["team", teamResult]
  ] as const) {
    if (result.status === "rejected") {
      console.error(`[dashboard/players/[id]] Could not load player ${relation}`, { playerId: id, error: result.reason });
    }
  }

  const [testResultsResult, trainingAttendancesResult] = await Promise.allSettled([
    db.testResult.findMany({
      where: { playerId: id, session: { status: "COMPLETED" } },
      include: {
        session: {
          include: { testDefinition: true }
        }
      },
      orderBy: { session: { date: "asc" } }
    }),
    db.trainingAttendance.findMany({
      where: { playerId: id },
      include: {
        training: {
          include: {
            team: true,
            coach: true
          }
        }
      },
      orderBy: {
        training: {
          date: "desc"
        }
      }
    })
  ]);

  const testResults = testResultsResult.status === "fulfilled" ? testResultsResult.value : [];
  const trainingAttendances = trainingAttendancesResult.status === "fulfilled" ? trainingAttendancesResult.value : [];
  if (testResultsResult.status === "rejected") {
    console.error("[dashboard/players/[id]] Could not load player test history", { playerId: id, error: testResultsResult.reason });
  }
  if (trainingAttendancesResult.status === "rejected") {
    console.error("[dashboard/players/[id]] Could not load player attendance history", { playerId: id, error: trainingAttendancesResult.reason });
  }

  const teams = authorizedTeams.some((tm) => tm.id === player.teamId)
    ? authorizedTeams
    : player.team
      ? [...authorizedTeams, player.team]
      : authorizedTeams;

  const canManagePlayerRecord = scopeContext.isUnrestricted || Boolean(
    player.teamId && scopeContext.authorizedTeamIds.includes(player.teamId)
  );
  const hasPlayerManagementPermission =
    hasPermission(user, "players.update") ||
    hasPermission(user, "players.archive") ||
    hasPermission(user, "players.delete");
  const canUpdate = hasPermission(user, "players.update") && canManagePlayerRecord;
  const canArchive = hasPermission(user, "players.archive") && canManagePlayerRecord;
  const canDelete = hasPermission(user, "players.delete") && canManagePlayerRecord;

  const bioAr = player.translations.find((tr) => tr.locale === "ar")?.biography ?? "";
  const bioFr = player.translations.find((tr) => tr.locale === "fr")?.biography ?? "";
  const mismatch = birthYearMismatch(player.dateOfBirth, player.team);

  // Group results by test definition for performance history
  const protocolGroupsMap = new Map<string, { definition: any; results: any[] }>();
  for (const res of testResults) {
    const def = res.session.testDefinition;
    if (!protocolGroupsMap.has(def.code)) {
      protocolGroupsMap.set(def.code, { definition: def, results: [] });
    }
    protocolGroupsMap.get(def.code)!.results.push({
      id: res.id,
      sessionId: res.session.id,
      sessionTitle: res.session.title,
      date: res.session.date,
      summaryScore: res.summaryScore,
      secondaryScore: res.secondaryScore,
      scoreDisplay: res.scoreDisplay,
      rank: res.rank,
      status: res.status,
      isCorrected: res.isCorrected,
      correctionReason: res.correctionReason,
    });
  }

  const performanceGroups: ProtocolPerformanceGroup[] = Array.from(protocolGroupsMap.values()).map(
    ({ definition, results }) => ({
      definitionCode: definition.code,
      definitionName: definition.name,
      category: definition.category,
      primaryUnit: definition.primaryUnit,
      secondaryUnit: definition.secondaryUnit,
      trend: analyzePlayerHistory(results, definition.direction),
    })
  );

  const cniDoc = player.documents.find(
    (d) =>
      d.name.includes("بطاقة التعريف") ||
      d.name.toLowerCase().includes("cni") ||
      d.name.toLowerCase().includes("identite")
  );
  const contractDoc = player.documents.find(
    (d) =>
      d.name.includes("عقد") ||
      d.name.toLowerCase().includes("contract") ||
      d.name.toLowerCase().includes("contrat")
  );
  const birthCertificateDoc = player.documents.find(
    (d) =>
      d.name.includes("ميلاد") ||
      d.name.toLowerCase().includes("birth") ||
      d.name.toLowerCase().includes("naissance")
  );
  const insuranceEval = evaluatePlayerInsurance(player.documents);
  const canViewMedical = hasPermission(user, "medical.records.view");
  const isAr = locale === "ar";

  // Calculate player age
  const birthDate = new Date(player.dateOfBirth);
  const ageDifMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(ageDifMs);
  const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);

  async function update(formData: FormData) {
    "use server";
    try {
      await updatePlayerAction(id, formData);
    } catch {
      redirect(`/${locale}/dashboard/players/${id}?notice=errors.playerSaveFailed`);
    }
    redirect(`/${locale}/dashboard/players/${id}?notice=playerSaved`);
  }
  async function archive() {
    "use server";
    await archivePlayerAction(id);
  }
  async function restore() {
    "use server";
    await restorePlayerAction(id);
  }
  async function hardDelete() {
    "use server";
    await hardDeletePlayerAction(id);
    redirect(`/${locale}/dashboard/players`);
  }

  return (
    <div className="w-full space-y-6">
      <PlayerPageFreshness />
      <NoticeToast notice={notice} />
      {/* ── Top Player Identity Header Card ── */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="h-20 w-20 overflow-hidden rounded-2xl border border-border/80 bg-muted/40 shadow-xs flex items-center justify-center">
                {player.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.photoUrl}
                    alt={`${player.firstName} ${player.lastName}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-muted-foreground/40" />
                )}
              </div>
              {player.shirtNumber && (
                <span className="absolute -bottom-2 -end-2 flex h-7 w-7 items-center justify-center rounded-lg bg-primary font-mono text-xs font-black text-primary-foreground shadow-xs">
                  {player.shirtNumber}
                </span>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">
                  {player.firstName} {player.lastName}
                </h1>
                <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {t(`positions.${player.position}` as any)}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  player.status === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : player.status === "INJURED"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {t(`statuses.${player.status}` as any)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {player.team && (
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground/80">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    {tTeams(`categories.${player.team.category}` as any)}
                  </span>
                )}
                <span>•</span>
                <span>{calculatedAge} {isAr ? "سنة" : "ans"}</span>
                <span>•</span>
                <span>{locale === "ar" ? arabicNationality(player.nationality) : frenchNationality(player.nationality)}</span>
                {player.height && (
                  <>
                    <span>•</span>
                    <span>{player.height} cm</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions & Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <OfficialPlayerAttestationModal
              player={{
                id: player.id,
                firstName: player.firstName,
                lastName: player.lastName,
                firstNameFr: player.firstNameFr,
                lastNameFr: player.lastNameFr,
                dateOfBirth: player.dateOfBirth,
                nationality: player.nationality,
                licenceNumber: player.licenceNumber,
                joiningDate: player.joiningDate,
                position: t(`positions.${player.position}` as any),
                shirtNumber: player.shirtNumber,
                teamName: player.team?.name,
                teamCategory: player.team ? tTeams(`categories.${player.team.category}` as any) : null,
                photoUrl: player.photoUrl
              }}
              locale={locale}
              triggerVariant="button"
            />

            {/* Insurance Status Badge */}
            {canViewMedical && insuranceEval.status === "INSURED" && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <div className="flex flex-col">
                  <span>{isAr ? "مؤمّن رسمياً (سارٍ)" : "Assuré (Valide)"}</span>
                  {insuranceEval.endDate && (
                    <span className="text-[10px] font-mono font-normal opacity-80">
                      {isAr ? "ينتهي:" : "Exp:"} {formatInsuranceDate(insuranceEval.endDate)}
                    </span>
                  )}
                </div>
              </div>
            )}
            {canViewMedical && insuranceEval.status === "EXPIRING_SOON" && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 shadow-xs">
                <Clock className="h-4 w-4" />
                <div className="flex flex-col">
                  <span>{isAr ? "تأمين ينتهي قريباً" : "Assurance expire bientôt"}</span>
                  <span className="text-[10px] font-mono font-normal opacity-80">
                    ({insuranceEval.daysRemaining} {isAr ? "يوم متبقي" : "jours"})
                  </span>
                </div>
              </div>
            )}
            {canViewMedical && insuranceEval.status === "EXPIRED" && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-red-600/10 border border-red-600/20 px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 shadow-xs">
                <XCircle className="h-4 w-4" />
                <span>{isAr ? "تأمين منتهي الصلاحية" : "Assurance expirée"}</span>
              </div>
            )}
            {canViewMedical && insuranceEval.status === "NOT_INSURED" && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span>{isAr ? "غير مؤمّن" : "Non assuré"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {mismatch && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm font-medium text-amber-900">
          {tTeams("birthYearWarning")}
        </div>
      )}

      {hasPlayerManagementPermission && !canManagePlayerRecord && (
        <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">
          {isAr
            ? "لا يمكن تعديل هذا اللاعب لأن فريقه خارج نطاق الفرق المرتبط بحسابك. اطلب من مدير المنصة ربط حسابك بالفئة المناسبة."
            : "Ce joueur est hors du périmètre des équipes associé à votre compte. Demandez à l’administrateur de vous rattacher à la catégorie concernée."}
        </div>
      )}

      {/* ── Main Workspace: Two Balanced Columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: Player Profile */}
        <div className="min-w-0 space-y-6">
          <form id="player-update-form" action={update} className="space-y-6">
            <input type="hidden" name="recordUpdatedAt" value={player.updatedAt.toISOString()} />
            {/* Section 1: Personal & Sporting Attributes */}
            <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-foreground">
                  {isAr ? "المعلومات الأساسية والرياضية" : "Informations principales & sportives"}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={isAr ? "الاسم (بالعربية)" : "Prénom (AR)"} name="firstName" defaultValue={player.firstName} disabled={!canUpdate} />
                <Field label={isAr ? "اللقب (بالعربية)" : "Nom (AR)"} name="lastName" defaultValue={player.lastName} disabled={!canUpdate} />
                <Field label={isAr ? "الاسم (بالفرنسية)" : "Prénom (FR)"} name="firstNameFr" defaultValue={player.firstNameFr ?? ""} disabled={!canUpdate} />
                <Field label={isAr ? "اللقب (بالفرنسية)" : "Nom (FR)"} name="lastNameFr" defaultValue={player.lastNameFr ?? ""} disabled={!canUpdate} />

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("fields.team")}
                  </label>
                  <FormSelect
                    name="teamId"
                    defaultValue={player.teamId ?? ""}
                    disabled={!canUpdate}
                    locale={locale}
                    ariaLabel={t("fields.team")}
                    options={[
                      { value: "", label: isAr ? "بدون فئة / لاعب على مستوى النادي" : "Sans catégorie / club" },
                      ...teams.map((tm) => ({ value: tm.id, label: tTeams(`categories.${tm.category}` as any) }))
                    ]}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("fields.position")}
                  </label>
                  <FormSelect
                    name="position"
                    defaultValue={player.position}
                    disabled={!canUpdate}
                    locale={locale}
                    ariaLabel={t("fields.position")}
                    options={POSITIONS.map((pos) => ({ value: pos, label: t(`positions.${pos}` as any) }))}
                  />
                </div>

                <Field label={t("fields.nationality")} name="nationality" defaultValue={player.nationality} disabled={!canUpdate} />
                <DateInput
                  label={t("fields.dateOfBirth")}
                  name="dateOfBirth"
                  defaultValue={player.dateOfBirth}
                  disabled={!canUpdate}
                  locale={locale}
                />
                <Field label={t("fields.placeOfBirth")} name="placeOfBirth" defaultValue={player.placeOfBirth ?? ""} disabled={!canUpdate} />
                <BloodGroupField label={t("fields.bloodGroup")} locale={locale} defaultValue={player.bloodGroup} disabled={!canUpdate} />

                <Field label={t("fields.shirtNumber")} name="shirtNumber" type="number" defaultValue={player.shirtNumber?.toString() ?? ""} disabled={!canUpdate} />

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("fields.status")}
                  </label>
                  <FormSelect
                    name="status"
                    defaultValue={player.status}
                    disabled={!canUpdate}
                    locale={locale}
                    ariaLabel={t("fields.status")}
                    options={STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}` as any) }))}
                  />
                </div>

                <Field label={`${t("fields.height")} (cm)`} name="height" type="number" min={120} max={230} step="1" defaultValue={player.height?.toString() ?? ""} disabled={!canUpdate} />
                <Field label={`${t("fields.weight")} (kg)`} name="weight" type="number" min={30} max={200} step="0.1" defaultValue={player.weight?.toString() ?? ""} disabled={!canUpdate} />

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("fields.preferredFoot")}
                  </label>
                  <FormSelect
                    name="preferredFoot"
                    defaultValue={player.preferredFoot ?? ""}
                    disabled={!canUpdate}
                    locale={locale}
                    ariaLabel={t("fields.preferredFoot")}
                    options={[
                      { value: "", label: "—" },
                      ...(["RIGHT", "LEFT", "BOTH"] as const).map((foot) => ({ value: foot, label: t(`feet.${foot}` as any) }))
                    ]}
                  />
                </div>

                <DateInput
                  label={t("fields.joiningDate")}
                  name="joiningDate"
                  defaultValue={player.joiningDate}
                  disabled={!canUpdate}
                  locale={locale}
                />

                <Field label={t("fields.previousTeam")} name="previousTeam" defaultValue={player.previousTeam ?? ""} disabled={!canUpdate} />
                <Field label={t("fields.birthCertificateNumber")} name="birthCertificateNumber" defaultValue={player.birthCertificateNumber ?? ""} disabled={!canUpdate} />
                <Field label={isAr ? "رقم رخصة اللاعب" : "N° de licence du joueur"} name="licenceNumber" defaultValue={player.licenceNumber ?? ""} disabled={!canUpdate} />
              </div>
            </div>

            {/* Section 2: Photo Management */}
            <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
              <PlayerPhotoEditor
                playerId={player.id}
                currentPhotoUrl={player.photoUrl}
                playerName={`${player.firstName} ${player.lastName}`}
                canUpdate={canUpdate}
                locale={locale}
              />
            </div>

            {/* Section 4: Biographies & Internal Notes */}
            <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("fields.biography")} (AR)
                  </label>
                  <textarea
                    name="biographyAr"
                    dir="rtl"
                    rows={3}
                    defaultValue={bioAr}
                    disabled={!canUpdate}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("fields.biography")} (FR)
                  </label>
                  <textarea
                    name="biographyFr"
                    dir="ltr"
                    rows={3}
                    defaultValue={bioFr}
                    disabled={!canUpdate}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("fields.internalNotes")}
                  </label>
                  <textarea
                    name="internalNotes"
                    rows={3}
                    defaultValue={player.internalNotes ?? ""}
                    disabled={!canUpdate}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Submit and Save */}
            {(canUpdate || canArchive || canDelete) && (
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2" dir={isAr ? "rtl" : "ltr"}>
                {canUpdate && <Button type="submit" className="inline-flex h-10 min-w-36 items-center justify-center gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"><Save className="h-4 w-4 shrink-0" /><span>{tCommon("save")}</span></Button>}
                {canArchive && (
                  player.status === "ARCHIVED" ? (
                    <ConfirmDialog
                      title={isAr ? "إرجاع اللاعب إلى القائمة النشطة؟" : "Restaurer ce joueur ?"}
                      body={isAr ? "سيعود اللاعب إلى الحالة النشطة وسيظهر مجددًا ضمن اللاعبين الحاليين." : "Le joueur repassera au statut actif et réapparaîtra dans l'effectif courant."}
                      onConfirm={restore}
                    >
                      <Button type="button" className="inline-flex h-10 min-w-40 items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700">
                        <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {isAr ? "إرجاع اللاعب" : "Restaurer le joueur"}
                      </Button>
                    </ConfirmDialog>
                  ) : (
                    <ConfirmDialog
                      title={isAr ? "أرشفة اللاعب؟" : "Archiver le joueur ?"}
                      body={isAr ? "سيختفي اللاعب من القوائم النشطة مع الاحتفاظ بملفه وسجلاته، ويمكن إرجاعه لاحقًا." : "Le joueur sera retiré des listes actives, tout en conservant son dossier et son historique."}
                      onConfirm={archive}
                    >
                      <Button type="button" className="inline-flex h-10 min-w-40 items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700">
                        <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {isAr ? "أرشفة اللاعب" : "Archiver le joueur"}
                      </Button>
                    </ConfirmDialog>
                  )
                )}
                {canDelete && (
                  <ConfirmDialog
                    title={isAr ? "حذف اللاعب نهائيًا؟" : "Supprimer définitivement ce joueur ?"}
                    body={isAr ? "سيتم حذف سجل اللاعب نهائيًا ولا يمكن التراجع عن هذا الإجراء." : "La fiche du joueur sera supprimée définitivement. Cette action est irréversible."}
                    onConfirm={hardDelete}
                  >
                    <Button type="button" size="icon" variant="destructive" className="h-10 w-10 shrink-0 bg-red-600 text-white hover:bg-red-700" aria-label={isAr ? "حذف اللاعب نهائيًا" : "Supprimer définitivement le joueur"} title={isAr ? "حذف نهائي" : "Suppression définitive"}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </ConfirmDialog>
                )}
              </div>
            )}
          </form>

        </div>

        {/* RIGHT COLUMN: Training Attendance Record & Physical Testing History */}
        <div className="min-w-0 space-y-6">
          <PlayerAttendanceCard attendances={trainingAttendances} locale={locale} />
          <PlayerPerformanceCard groups={performanceGroups} locale={locale} />
            {/* Section 3: Official Player Documents */}
            <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isAr ? "وثائق ومستندات اللاعب الرسمية" : "Documents officiels du joueur"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? "المستندات الثبوتية الأربعة مع التحقق الذكي والمعاينة الفورية"
                      : "Les 4 justificatifs officiels avec contrôle intelligent et aperçu direct"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <DocumentUploadField
                  name="cniFile"
                  label={isAr ? "بطاقة التعريف الوطنية (CNI)" : "Carte Nationale d'Identité (CNI)"}
                  description={isAr ? "نسخة ممسوحة ضوئياً للبطاقة البيومترية" : "Copie numérisée de la carte biométrique"}
                  locale={locale}
                  formId="player-update-form"
                  existingDocument={cniDoc ? {
                    id: cniDoc.id,
                    name: cniDoc.name,
                    mimeType: cniDoc.mimeType,
                    originalName: cniDoc.originalName,
                    sizeBytes: cniDoc.sizeBytes
                  } : null}
                />
                <DocumentUploadField
                  name="contractFile"
                  label={isAr ? "عقد اللاعب الرسمي" : "Contrat officiel du joueur"}
                  description={isAr ? "العقد المبرم مع النادي والمختوم" : "Contrat signé et paraphé avec le club"}
                  locale={locale}
                  formId="player-update-form"
                  existingDocument={contractDoc ? {
                    id: contractDoc.id,
                    name: contractDoc.name,
                    mimeType: contractDoc.mimeType,
                    originalName: contractDoc.originalName,
                    sizeBytes: contractDoc.sizeBytes
                  } : null}
                />
                <DocumentUploadField
                  name="birthCertificateFile"
                  label={isAr ? "شهادة الميلاد (عقد الميلاد)" : "Acte de naissance"}
                  description={isAr ? "مستخرج ميلاد رسمي حديث" : "Extrait de naissance officiel récent"}
                  locale={locale}
                  formId="player-update-form"
                  existingDocument={birthCertificateDoc ? {
                    id: birthCertificateDoc.id,
                    name: birthCertificateDoc.name,
                    mimeType: birthCertificateDoc.mimeType,
                    originalName: birthCertificateDoc.originalName,
                    sizeBytes: birthCertificateDoc.sizeBytes
                  } : null}
                />
                {canViewMedical && <Link href={`/${locale}/dashboard/medical-records/${player.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 text-sm font-bold text-primary hover:bg-primary/10"><ShieldCheck className="h-4 w-4" />{isAr ? "فتح الملف الطبي" : "Ouvrir le dossier médical"}</Link>}
              </div>
            </div>

        </div>
      </div>
    </div>
  );
}
