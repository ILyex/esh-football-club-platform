import { FileText, Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { getCurrentTeamId } from "@/lib/team-context";
import { createMeetingMinuteAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { MeetingTeamSelect } from "@/components/meetings/meeting-team-select";
import { MeetingAttendeesInput } from "@/components/meetings/meeting-attendees-input";

export default async function NewMeetingMinutePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ event?: string }> }) {
  const { locale } = await params;
  const { event: eventId } = await searchParams;
  await requirePagePermission("meetings.manage", locale);
  const t = await getTranslations("meetings");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const [teams, currentTeamId, calendarEvent] = await Promise.all([
    db.team.findMany({ orderBy: { category: "asc" } }),
    getCurrentTeamId(),
    eventId ? db.calendarEvent.findUnique({ where: { id: eventId }, include: { meetingMinute: { select: { id: true } } } }) : Promise.resolve(null)
  ]);
  const linkedEvent = calendarEvent?.type === "MEETING" && calendarEvent.endDateTime <= new Date() && !calendarEvent.meetingMinute ? calendarEvent : null;

  async function action(formData: FormData) {
    "use server";
    const { id } = await createMeetingMinuteAction(formData);
    redirect(`/${locale}/dashboard/meeting-minutes/${id}`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header className="text-center">
        <h1 className="inline-flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          <FileText className="h-5 w-5 shrink-0 text-club-primary" aria-hidden="true" />
          {t("addMeeting")}
        </h1>
      </header>

      <form action={action} className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7">
        {linkedEvent && <input type="hidden" name="calendarEventId" value={linkedEvent.id} />}
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          <legend className="mb-4 w-full border-b border-border pb-2 text-sm font-bold text-foreground">
            {t("sections.meetingInfo")}
          </legend>
          <div className="sm:col-span-2">
            <label htmlFor="meeting-title" className="mb-1.5 block text-sm font-medium">{t("fields.meetingTitle")}</label>
            {linkedEvent ? <><input type="hidden" name="title" value={linkedEvent.title} /><input id="meeting-title" value={linkedEvent.title} readOnly className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm" /></> : <input id="meeting-title" name="title" required className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-club-primary focus:ring-1 focus:ring-club-primary" />}
          </div>
          {linkedEvent ? <><DateTimeInput label={t("fields.date")} defaultValue={linkedEvent.startDateTime} disabled locale={locale} /><input type="hidden" name="date" value={linkedEvent.startDateTime.toISOString()} /></> : <DateTimeInput label={t("fields.date")} name="date" required locale={locale} />}
          <div>
            <label htmlFor="meeting-location" className="mb-1.5 block text-sm font-medium">{t("fields.location")}</label>
            {linkedEvent ? <><input type="hidden" name="location" value={linkedEvent.location ?? ""} /><input id="meeting-location" value={linkedEvent.location ?? "—"} readOnly className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm" /></> : <input id="meeting-location" name="location" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-club-primary focus:ring-1 focus:ring-club-primary" />}
          </div>
          <div className="sm:col-span-2">
            {linkedEvent ? <>
              <label className="mb-1.5 block text-sm font-medium">{t("fields.team")}</label>
              <div className="rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                {teams.find((team) => team.id === linkedEvent.teamId)
                  ? tTeams(`categories.${teams.find((team) => team.id === linkedEvent.teamId)!.category}` as any)
                  : "—"}
              </div>
              <input type="hidden" name="teamId" value={linkedEvent.teamId ?? ""} />
            </> : <MeetingTeamSelect
              value={currentTeamId ?? ""}
              locale={locale}
              options={[
                { id: "", label: "—" },
                ...teams.map((tm) => ({ id: tm.id, label: tTeams(`categories.${tm.category}` as any) }))
              ]}
            />}
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-border pt-5">
          <legend className="mb-1 w-full border-b border-border pb-2 text-sm font-bold text-foreground">
            {t("sections.minutesDetails")}
          </legend>
          <div>
            <label htmlFor="meeting-attendees" className="mb-1.5 block text-sm font-medium">{t("fields.attendees")}</label>
            <MeetingAttendeesInput id="meeting-attendees" placeholder={t("attendeesHint")} locale={locale} />
          </div>
          <div>
            <label htmlFor="meeting-agenda" className="mb-1.5 block text-sm font-medium">{t("fields.agenda")}</label>
            <textarea id="meeting-agenda" name="agenda" rows={3} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-club-primary focus:ring-1 focus:ring-club-primary" />
          </div>
          <div>
            <label htmlFor="meeting-content" className="mb-1.5 block text-sm font-medium">{t("fields.content")}</label>
            <textarea id="meeting-content" name="content" rows={5} required className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-club-primary focus:ring-1 focus:ring-club-primary" />
          </div>
          <div>
            <label htmlFor="meeting-decisions" className="mb-1.5 block text-sm font-medium">{t("fields.decisions")}</label>
            <textarea id="meeting-decisions" name="decisions" rows={3} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-club-primary focus:ring-1 focus:ring-club-primary" />
          </div>
          <div>
            <label htmlFor="meeting-notes" className="mb-1.5 block text-sm font-medium">{t("fields.notes")}</label>
            <textarea id="meeting-notes" name="notes" rows={2} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-club-primary focus:ring-1 focus:ring-club-primary" />
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-dashed border-border bg-muted/20 p-4 sm:p-5">
          <legend className="px-1 text-sm font-semibold text-foreground">
            <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-club-primary" />{t("sections.attachment")}</span>
          </legend>
          <p className="mb-3 text-xs leading-5 text-muted-foreground">{locale === "ar" ? "صيغ مدعومة: PDF, PNG, JPG, DOCX (الحجم الأقصى 10 ميغابايت)" : "Formats acceptés : PDF, PNG, JPG, DOCX (taille maximale : 10 Mo)"}</p>
          <input
            name="file"
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="w-full text-sm text-muted-foreground file:me-3 file:rounded-lg file:border-0 file:bg-club-primary/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-club-primary hover:file:bg-club-primary/15"
          />
        </fieldset>

        <div className="flex justify-center border-t border-border pt-5">
          <Button type="submit" className="min-w-36 gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
        </div>
      </form>
    </div>
  );
}
