import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { notFound } from "next/navigation";
import {
  updateMatchAction,
  deleteMatchAction,
  addMatchEventAction,
  deleteMatchEventAction,
  upsertLineupEntryAction,
  removeLineupEntryAction,
  attachMatchSheetAction
} from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal";
import { RefereeReportAiModal } from "@/components/matches/referee-report-ai-modal";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Save, FileCheck, FileText, Download, Upload, ExternalLink, Image as ImageIcon, Target, Square } from "lucide-react";
import { getOpponentLogo } from "@/lib/opponents";

const EVENT_TYPES = ["GOAL", "OWN_GOAL", "ASSIST", "YELLOW_CARD", "RED_CARD", "SUBSTITUTION_IN", "SUBSTITUTION_OUT"] as const;

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
        events: { include: { player: true, staff: true }, orderBy: { minute: "asc" } },
        lineups: { include: { player: true } },
        documents: { orderBy: { createdAt: "desc" } }
      }
    }),
    db.competition.findMany({ orderBy: { name: "asc" } }),
    db.player.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { lastName: "asc" } }),
    db.team.findMany({ orderBy: { category: "asc" } }),
    db.staff.findMany({ where: { status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] })
  ]);
  if (!match) notFound();

  const scopeContext = await getMutationScopeContext();
  try {
    assertTeamScope(scopeContext, match.teamId, "Match", { allowClubWide: true });
  } catch {
    notFound();
  }

  const opponent = match.isHomeFixture ? match.awayTeamName : match.homeTeamName;
  const opponentLogo = await getOpponentLogo(opponent);
  const lineupPlayerIds = new Set(match.lineups.map((l) => l.playerId));

  async function update(formData: FormData) {
    "use server";
    await updateMatchAction(id, formData);
  }
  async function remove() {
    "use server";
    await deleteMatchAction(id);
  }
  async function addEvent(formData: FormData) {
    "use server";
    await addMatchEventAction(id, formData);
  }
  async function addLineupEntry(formData: FormData) {
    "use server";
    await upsertLineupEntryAction(id, formData);
  }
  async function attachSheet(formData: FormData) {
    "use server";
    await attachMatchSheetAction(id, formData);
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

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold">
          {match.homeTeamName} vs {match.awayTeamName}
        </h1>
        <p className="text-sm text-muted-foreground">{match.competition.name}</p>
      </div>

      <form action={update} className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 sm:p-6 shadow-xs">
        <div>
          <label className="mb-1 block text-sm font-medium">{tTeams("title")}</label>
          <select
            name="teamId"
            defaultValue={match.teamId ?? ""}
            disabled={!canUpdate}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tTeams(`categories.${tm.category}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.competition")}</label>
          <select
            name="competitionId"
            defaultValue={match.competitionId}
            disabled={!canUpdate}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-1 md:col-span-2 space-y-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.opponent")}</label>
          <div className="flex items-center gap-3">
            <input
              name="opponent"
              defaultValue={opponent}
              disabled={!canUpdate}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
            />
            {opponentLogo && (
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 shrink-0" title={locale === "ar" ? "شعار الخصم الحالي" : "Logo actuel"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={opponentLogo} alt="" className="h-6 w-6 object-contain" />
                <span className="text-[11px] font-medium text-muted-foreground">{locale === "ar" ? "شعار مسجل" : "Logo"}</span>
              </div>
            )}
          </div>
          {canUpdate && (
            <div className="pt-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                <ImageIcon className="h-3.5 w-3.5" />
                <span>{locale === "ar" ? "تحديث أو رفع شعار الفريق الخصم:" : "Mettre à jour le logo adverse:"}</span>
              </label>
              <input
                type="file"
                name="opponentLogoFile"
                accept="image/png,image/jpeg,image/webp"
                className="w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-border file:bg-background file:text-xs"
              />
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="isHomeFixture" type="checkbox" defaultChecked={match.isHomeFixture} disabled={!canUpdate} />
          {t("fields.isHomeFixture")}
        </label>
        <div>
          <label className="mb-1 block text-sm font-medium">{tCommon("status")}</label>
          <select
            name="status"
            defaultValue={match.status}
            disabled={!canUpdate}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            {["SCHEDULED", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <DateTimeInput
            label={t("fields.matchDate")}
            name="matchDate"
            defaultValue={match.matchDate}
            disabled={!canUpdate}
            locale={locale}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.stadium")}</label>
          <input
            name="stadium"
            defaultValue={match.stadium ?? ""}
            disabled={!canUpdate}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.refereeName")}</label>
          <input
            name="refereeName"
            defaultValue={match.refereeName ?? ""}
            disabled={!canUpdate}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.homeScore")}</label>
          <input
            name="homeScore"
            type="number"
            min={0}
            defaultValue={match.homeScore ?? ""}
            disabled={!canUpdate}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.awayScore")}</label>
          <input
            name="awayScore"
            type="number"
            min={0}
            defaultValue={match.awayScore ?? ""}
            disabled={!canUpdate}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.matchReport")}</label>
          <textarea
            name="matchReport"
            rows={4}
            defaultValue={match.matchReport ?? ""}
            disabled={!canUpdate}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
        {canUpdate && (
          <div className="col-span-1 md:col-span-2">
            <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
          </div>
        )}
      </form>

      {/* ---------------------------------- Match documents */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  {locale === "ar" ? "وثائق المباراة المحفوظة" : "Documents enregistrés du match"}
                </h2>
                <Badge tone="neutral" className="text-[10px] font-mono">ems.fafconnect.dz</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {locale === "ar"
                  ? "يمكن رفع ورقة التشكيل وتقرير الحكم يدوياً. لا يتوفر حالياً استيراد آلي موثق من FAF Connect."
                  : "Vous pouvez téléverser la feuille de composition et le rapport d'arbitrage. L'import automatisé depuis FAF Connect n'est pas disponible."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://ems.fafconnect.dz/game-week"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <span>{locale === "ar" ? "بوابة FAF EMS" : "Portail FAF EMS"}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>

          </div>
        </div>

        {/* 1. Pre-Match Lineup Sheet Card */}
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-foreground">
                {locale === "ar" ? "1. ورقة التشكيل قبل المباراة" : "1. Feuille de composition avant match"}
              </h3>
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
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {locale === "ar"
                ? "لم تُرفع ورقة التشكيل قبل المباراة بعد."
                : "La feuille de composition n'a pas encore été déposée."}
            </p>
          )}

          {canReport && (
            <form action={attachSheet} className="pt-1">
              <input type="hidden" name="sheetType" value="PRE_MATCH_SHEET" />
              <input type="hidden" name="locale" value={locale} />
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  name="sheetFile"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="text-xs text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-[11px] flex-1"
                />
                <Button type="submit" size="sm" variant="ghost" className="h-7 text-xs gap-1">
                  <Upload className="h-3 w-3" />
                  <span>{locale === "ar" ? "رفع الورقة" : "Déposer"}</span>
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* 2. Post-Match Referee Report Card */}
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-foreground">
                {locale === "ar" ? "2. تقرير حكم اللقاء بعد المباراة" : "2. Rapport d'arbitrage après match"}
              </h3>
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
              <div className="flex items-center gap-2 shrink-0">
                <RefereeReportAiModal
                  matchId={match.id}
                  defaultText={match.matchReport || ""}
                  locale={locale}
                  hasAttachedReport={true}
                />
                <DocumentPreviewModal
                  documentId={refereeReport.id}
                  title={refereeReport.name}
                  fileName={refereeReport.originalName}
                  mimeType={refereeReport.mimeType}
                  locale={locale}
                  buttonLabel={locale === "ar" ? "معاينة التقرير" : "Aperçu"}
                />
                <a
                  href={`/api/documents/${refereeReport.id}/download`}
                  download
                  className="inline-flex items-center gap-1 rounded-md bg-club-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-club-primary/90 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "تحميل" : "Télécharger"}</span>
                </a>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {locale === "ar"
                ? "يتم رفع تقرير الحكم الصادر إلكترونياً لتثبيت نتيجة المباراة والبطاقات الممنوحة رسمياً."
                : "Le rapport d'arbitrage officialise le score final et les sanctions disciplinaires."}
            </p>
          )}

          {canReport && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/50">
              <form action={attachSheet} className="flex-1 min-w-[220px]">
                <input type="hidden" name="sheetType" value="REFEREE_REPORT" />
                <input type="hidden" name="locale" value={locale} />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    name="sheetFile"
                    required
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="text-xs text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-[11px] flex-1"
                  />
                  <Button type="submit" size="sm" variant="ghost" className="h-7 text-xs gap-1">
                    <Upload className="h-3 w-3" />
                    <span>{locale === "ar" ? "رفع تقرير الحكم" : "Déposer"}</span>
                  </Button>
                </div>
              </form>

              {!refereeReport && (
                <RefereeReportAiModal
                  matchId={match.id}
                  defaultText={match.matchReport || ""}
                  locale={locale}
                  hasAttachedReport={false}
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* Match events */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold">{t("events.title")}</h2>
        <ul className="mb-4 divide-y divide-border">
          {match.events.map((e) => {
            async function removeEvent() {
              "use server";
              await deleteMatchEventAction(id, e.id);
            }
            return (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="inline-flex items-center gap-1.5">
                    {e.type === "GOAL" || e.type === "OWN_GOAL" ? <Target className="h-3.5 w-3.5 text-emerald-500" /> : null}
                    {e.type === "YELLOW_CARD" ? <Square className="h-3.5 w-3.5 fill-yellow-400 text-yellow-500" /> : null}
                    {e.type === "RED_CARD" ? <Square className="h-3.5 w-3.5 fill-red-500 text-red-600" /> : null}
                    {e.minute}&apos; — {t(`events.${e.type}` as any)} {e.player ? `(${e.player.firstName} ${e.player.lastName})` : e.staff ? `(${e.staff.firstName} ${e.staff.lastName})` : ""}
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {e.source === "REFEREE_REPORT" ? (locale === "ar" ? "تقرير الحكم" : "Rapport arbitral") : (locale === "ar" ? "المنصة" : "Plateforme")}
                    </span>
                  </span>
                </span>
                {canReport && (
                  <ConfirmDialog onConfirm={removeEvent}>
                    <button className="text-xs text-destructive underline">{tCommon("delete")}</button>
                  </ConfirmDialog>
                )}
              </li>
            );
          })}
          {match.events.length === 0 && <li className="py-2 text-sm text-muted-foreground">{tCommon("noResults")}</li>}
        </ul>

        {canReport && match.status === "LIVE" && (
          <form action={addEvent} className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-background/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium">{t("events.minute")}</label>
              <input name="minute" type="number" min={0} max={130} placeholder="34" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t("events.type")}</label>
              <select name="type" required className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                {EVENT_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(`events.${ty}` as any)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{locale === "ar" ? "الفريق المسجل" : "Équipe qui marque"}</label>
              <select name="side" defaultValue="HOME" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="HOME">{match.homeTeamName}</option>
                <option value="AWAY">{match.awayTeamName}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t("events.player")}</label>
              <select name="playerId" defaultValue="" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">—</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{locale === "ar" ? "نوع صاحب الحدث" : "Participant"}</label>
              <select name="entityType" defaultValue="PLAYER" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="PLAYER">{locale === "ar" ? "لاعب" : "Joueur"}</option>
                <option value="STAFF">{locale === "ar" ? "طاقم" : "Staff"}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{locale === "ar" ? "عضو الطاقم (للبطاقات)" : "Membre du staff (cartons)"}</label>
              <select name="staffId" defaultValue="" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">—</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
              </select>
            </div>
            <Button type="submit" variant="outline">
              {t("events.addEvent")}
            </Button>
          </form>
        )}
        {canReport && match.status !== "LIVE" && (
          <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            {locale === "ar" ? "تسجيل الأهداف والبطاقات متاح فقط عندما تكون المباراة مباشرة." : "L’enregistrement des buts et cartons est disponible uniquement lorsque le match est en direct."}
          </p>
        )}
      </div>

      {/* Lineup */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold">{t("lineup.title")}</h2>
        <ul className="mb-4 divide-y divide-border">
          {match.lineups.map((l) => {
            async function removeEntry() {
              "use server";
              await removeLineupEntryAction(id, l.playerId);
            }
            return (
              <li key={l.playerId} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {l.player.firstName} {l.player.lastName}{" "}
                  <Badge tone={l.isStarting ? "success" : "neutral"}>{l.isStarting ? t("lineup.starting") : t("lineup.substitute")}</Badge>
                  {l.position ? ` — ${l.position}` : ""}
                </span>
                {canReport && (
                  <ConfirmDialog onConfirm={removeEntry}>
                    <button className="text-xs text-destructive underline">{tCommon("delete")}</button>
                  </ConfirmDialog>
                )}
              </li>
            );
          })}
          {match.lineups.length === 0 && <li className="py-2 text-sm text-muted-foreground">{tCommon("noResults")}</li>}
        </ul>

        {canReport && match.status === "LIVE" && (
          <form action={addLineupEntry} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium">{t("events.player")}</label>
              <select name="playerId" required className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                {players
                  .filter((p) => !lineupPlayerIds.has(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t("lineup.position")}</label>
              <input name="position" className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input name="isStarting" type="checkbox" defaultChecked /> {t("lineup.starting")}
            </label>
            <Button type="submit" variant="outline">
              {t("lineup.addPlayer")}
            </Button>
          </form>
        )}
      </div>

      {canDelete && (
        <ConfirmDialog onConfirm={remove}>
          <Button variant="destructive">{tCommon("delete")}</Button>
        </ConfirmDialog>
      )}
    </div>
  );
}
