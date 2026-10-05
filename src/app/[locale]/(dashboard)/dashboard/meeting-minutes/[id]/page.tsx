import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { notFound } from "next/navigation";
import { updateMeetingMinuteAction, attachMeetingDocumentAction, detachMeetingDocumentAction, uploadAndAttachMeetingDocumentAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { MeetingAttendeesInput } from "@/components/meetings/meeting-attendees-input";
import { Save,  FileText, Download, Upload, Paperclip } from "lucide-react";

export default async function MeetingMinuteDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requirePermission("meetings.view");
  const t = await getTranslations("meetings");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "meetings.manage");
  const canSeeRestricted = hasPermission(user, "documents.view.restricted");

  const [meeting, teams, availableDocuments] = await Promise.all([
    db.meetingMinute.findUnique({ where: { id }, include: { attachments: { include: { document: true } }, calendarEvent: true } }),
    db.team.findMany({ orderBy: { category: "asc" } }),
    db.document.findMany({
      where: canSeeRestricted ? {} : { classification: { in: ["PUBLIC", "INTERNAL"] } },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  ]);
  if (!meeting) notFound();

  const scopeContext = await getMutationScopeContext();
  try {
    assertTeamScope(scopeContext, meeting.teamId, "MeetingMinute", { allowClubWide: true });
  } catch {
    notFound();
  }

  const attachedIds = new Set(meeting.attachments.map((a) => a.documentId));

  async function update(formData: FormData) {
    "use server";
    await updateMeetingMinuteAction(id, formData);
  }
  async function attach(formData: FormData) {
    "use server";
    await attachMeetingDocumentAction(id, formData);
  }
  async function uploadAndAttach(formData: FormData) {
    "use server";
    await uploadAndAttachMeetingDocumentAction(id, formData);
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">{meeting.title}</h1>
      {meeting.calendarEventId && <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">{locale === "ar" ? "موعد هذا الاجتماع مرتبط بالرزنامة. لتعديل العنوان أو التاريخ أو المكان، حدّث الموعد من قسم الرزنامة." : "Cette réunion est liée au calendrier. Modifiez son titre, sa date ou son lieu depuis le calendrier."}</p>}

      <form action={update} className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.meetingTitle")}</label>
          <input name="title" defaultValue={meeting.title} disabled={!canManage || Boolean(meeting.calendarEventId)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div>
          <DateTimeInput
            label={t("fields.date")}
            name="date"
            defaultValue={meeting.date}
            disabled={!canManage || Boolean(meeting.calendarEventId)}
            locale={locale}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.location")}</label>
          <input name="location" defaultValue={meeting.location ?? ""} disabled={!canManage || Boolean(meeting.calendarEventId)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.team")}</label>
          <select name="teamId" defaultValue={meeting.teamId ?? ""} disabled={!canManage || Boolean(meeting.calendarEventId)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
            <option value="">—</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tTeams(`categories.${tm.category}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.status")}</label>
          <select name="status" defaultValue={meeting.status} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
            {["DRAFT", "APPROVED", "ARCHIVED"].map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}` as any)}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label htmlFor="meeting-attendees" className="mb-1 block text-sm font-medium">{t("fields.attendees")}</label>
          <MeetingAttendeesInput id="meeting-attendees" initialValue={meeting.attendees} placeholder={t("attendeesHint")} locale={locale} disabled={!canManage} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.agenda")}</label>
          <textarea name="agenda" rows={3} defaultValue={meeting.agenda ?? ""} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.content")}</label>
          <textarea name="content" rows={5} defaultValue={meeting.content} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.decisions")}</label>
          <textarea name="decisions" rows={4} defaultValue={meeting.decisions ?? ""} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.notes")}</label>
          <textarea name="notes" rows={2} defaultValue={meeting.notes ?? ""} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>

        {canManage && (
          <div className="col-span-2">
            <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
          </div>
        )}
      </form>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-primary" />
            {t("fields.attachments")}
          </h2>
          <span className="text-xs text-muted-foreground">({meeting.attachments.length})</span>
        </div>

        {/* Attachments list with download and preview */}
        <ul className="mb-6 divide-y divide-border">
          {meeting.attachments.map((a) => {
            async function detach() {
              "use server";
              await detachMeetingDocumentAction(id, a.documentId);
            }
            return (
              <li key={a.documentId} className="flex items-center justify-between py-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded bg-muted p-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.document.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(a.document.sizeBytes)} • {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(a.document.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ms-2">
                  <a
                    href={`/api/documents/${a.documentId}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5 text-primary" />
                    <span>{locale === "ar" ? "تحميل / معاينة" : "Télécharger / Voir"}</span>
                  </a>
                  {canManage && (
                    <ConfirmDialog onConfirm={detach}>
                      <button type="button" className="text-xs text-destructive hover:underline">{tCommon("delete")}</button>
                    </ConfirmDialog>
                  )}
                </div>
              </li>
            );
          })}
          {meeting.attachments.length === 0 && (
            <li className="py-4 text-center text-sm text-muted-foreground">
              {locale === "ar" ? "لا توجد مرفقات مرتبطة بمحضر الاجتماع هذا." : "Aucune pièce jointe liée à ce procès-verbal."}
            </li>
          )}
        </ul>

        {canManage && (
          <div className="space-y-4 border-t border-border pt-4">
            {/* Direct upload form */}
            <form action={uploadAndAttach} className="rounded-md border border-dashed border-border/80 bg-muted/20 p-4">
              <h3 className="mb-2 text-xs font-semibold flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5 text-primary" />
                {locale === "ar" ? "رفع وثيقة أو محضر موقع مباشرة" : "Téléverser directement un PV signé ou document"}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">{locale === "ar" ? "اسم الوثيقة (اختياري)" : "Nom du document (optionnel)"}</label>
                  <input name="name" placeholder={meeting.title} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">{locale === "ar" ? "الملف" : "Fichier"}</label>
                  <input
                    name="file"
                    type="file"
                    required
                    accept=".pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs file:me-2 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-0.5 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button type="submit" size="sm" variant="default" className="text-xs">
                  <Upload className="me-1 h-3.5 w-3.5" />
                  {locale === "ar" ? "رفع وإرفاق" : "Téléverser et joindre"}
                </Button>
              </div>
            </form>

            {/* Attach existing document */}
            <form action={attach} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[240px] flex-1">
                <select name="documentId" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="">{locale === "ar" ? "-- اختر وثيقة محفوظة مسبقاً --" : "-- Choisir un document existant --"}</option>
                  {availableDocuments
                    .filter((d) => !attachedIds.has(d.id))
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(d.createdAt)})
                      </option>
                    ))}
                </select>
              </div>
              <Button type="submit" variant="outline" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
