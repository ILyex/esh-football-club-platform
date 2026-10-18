import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, MapPin, Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePagePermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { createScheduledMeetingAction } from "../actions";

export default async function ScheduleMeetingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("meetings.manage", locale);
  const t = await getTranslations("meetings");
  const tCommon = await getTranslations("common");
  const isAr = locale === "ar";

  async function action(formData: FormData) {
    "use server";
    const { id } = await createScheduledMeetingAction(formData);
    redirect(`/${locale}/dashboard/meeting-minutes?created=${encodeURIComponent(id)}`);
  }

  const inputClass = "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-club-primary focus:ring-2 focus:ring-club-primary/15";
  return <div className="mx-auto w-full max-w-3xl space-y-5">
    <header className="rounded-2xl border border-border bg-card p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-club-primary/10 text-club-primary"><CalendarPlus className="h-5 w-5" /></span>
        <div><h1 className="text-xl font-bold text-foreground sm:text-2xl">{t("createMeeting")}</h1><p className="mt-1 text-sm leading-6 text-muted-foreground">{t("scheduleDescription")}</p></div>
      </div>
    </header>
    <form action={action} className="grid grid-cols-1 gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:grid-cols-2 sm:p-7">
      <div className="sm:col-span-2">
        <label htmlFor="meeting-title" className="mb-1.5 block text-sm font-semibold">{t("fields.meetingTitle")}</label>
        <input id="meeting-title" name="title" required maxLength={160} className={inputClass} />
      </div>
      <DateTimeInput label={t("fields.startDateTime")} name="startDateTime" required locale={locale} />
      <DateTimeInput label={t("fields.endDateTime")} name="endDateTime" required locale={locale} />
      <div className="sm:col-span-2">
        <label htmlFor="meeting-location" className="mb-1.5 block text-sm font-semibold"><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-muted-foreground" />{t("fields.location")}</span></label>
        <input id="meeting-location" name="location" maxLength={160} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="meeting-description" className="mb-1.5 block text-sm font-semibold">{t("fields.description")}</label>
        <textarea id="meeting-description" name="description" rows={4} maxLength={2000} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
      </div>
      <p className="rounded-xl bg-muted/50 px-4 py-3 text-xs leading-5 text-muted-foreground sm:col-span-2">{t("notificationInfo")}</p>
      <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end">
        <Link href={`/${locale}/dashboard/meeting-minutes`} className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted">{tCommon("cancel")}</Link>
        <Button type="submit" className="h-10 gap-2 rounded-xl px-5"><Save className="h-4 w-4" />{t("saveMeeting")}</Button>
      </div>
    </form>
  </div>;
}
