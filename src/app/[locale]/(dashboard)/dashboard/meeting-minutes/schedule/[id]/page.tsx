import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, MapPin, Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { ScheduleMeetingForm } from "@/components/meetings/schedule-meeting-form";
import { updateScheduledMeetingAction } from "../../actions";

export default async function EditScheduledMeetingPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { locale, id } = await params;
  const query = await searchParams;
  await requirePagePermission("meetings.manage", locale);
  const meeting = await db.calendarEvent.findUnique({ where: { id } });
  if (!meeting || meeting.type !== "MEETING" || meeting.relatedMatchId || meeting.relatedTrainingId) notFound();
  assertTeamScope(await getMutationScopeContext(), meeting.teamId, "CalendarEvent", { allowClubWide: true });

  const t = await getTranslations("meetings");
  const tCommon = await getTranslations("common");
  const isAr = locale === "ar";
  async function action(formData: FormData) {
    "use server";
    await updateScheduledMeetingAction(id, formData);
    redirect(`/${locale}/dashboard/meeting-minutes?updated=${encodeURIComponent(id)}`);
  }

  const inputClass = "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-club-primary focus:ring-2 focus:ring-club-primary/15";
  return <div className="mx-auto w-full max-w-3xl space-y-5">
    <header className="rounded-2xl border border-border bg-card p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-club-primary/10 text-club-primary"><CalendarClock className="h-5 w-5" /></span>
        <div><h1 className="text-xl font-bold text-foreground sm:text-2xl">{isAr ? "تعديل الاجتماع" : "Modifier la réunion"}</h1><p className="mt-1 text-sm leading-6 text-muted-foreground">{isAr ? "حدّث تفاصيل الموعد؛ ستظهر التغييرات في التطبيق والرزنامة." : "Modifiez les détails ; les changements seront visibles dans l’application et le calendrier."}</p></div>
      </div>
    </header>
    <ScheduleMeetingForm action={action} locale={locale} serverError={query.error === "end-before-start" || query.error === "invalid-schedule" ? query.error : undefined}>
      <div className="sm:col-span-2"><label htmlFor="meeting-title" className="mb-1.5 block text-sm font-semibold">{t("fields.meetingTitle")}</label><input id="meeting-title" name="title" required maxLength={160} defaultValue={meeting.title} className={inputClass} /></div>
      <DateTimeInput label={t("fields.startDateTime")} name="startDateTime" defaultValue={meeting.startDateTime} required locale={locale} />
      <DateTimeInput label={t("fields.endDateTime")} name="endDateTime" defaultValue={meeting.endDateTime} required locale={locale} />
      <div className="sm:col-span-2"><label htmlFor="meeting-location" className="mb-1.5 block text-sm font-semibold"><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-muted-foreground" />{t("fields.location")}</span></label><input id="meeting-location" name="location" maxLength={160} defaultValue={meeting.location ?? ""} className={inputClass} /></div>
      <div className="sm:col-span-2"><label htmlFor="meeting-description" className="mb-1.5 block text-sm font-semibold">{t("fields.description")}</label><textarea id="meeting-description" name="description" rows={4} maxLength={2000} defaultValue={meeting.description ?? ""} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" /></div>
      <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end">
        <Link href={`/${locale}/dashboard/meeting-minutes`} className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted">{tCommon("cancel")}</Link>
        <Button type="submit" className="h-10 gap-2 rounded-xl px-5"><Save className="h-4 w-4" />{isAr ? "حفظ التعديلات" : "Enregistrer les modifications"}</Button>
      </div>
    </ScheduleMeetingForm>
  </div>;
}
