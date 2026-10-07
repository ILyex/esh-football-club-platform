import Link from "next/link";
import { Plus, ChevronRight, Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { updateCalendarEventAction, deleteCalendarEventAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { FormSelect } from "@/components/ui/form-select";

const TYPES = ["MEETING", "ADMINISTRATIVE", "OTHER"] as const;

export default async function CalendarEventDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requirePagePermission("calendar.view", locale);
  const t = await getTranslations("calendar");
  const tCommon = await getTranslations("common");
  const isAr = locale === "ar";
  const canManage = hasPermission(user, "calendar.manage");

  const event = await db.calendarEvent.findUnique({ where: { id } });
  if (!event) notFound();

  // Auto-synced events are edited from their source module.
  if (event.relatedMatchId) redirect(`/${locale}/dashboard/matches/${event.relatedMatchId}`);
  if (event.relatedTrainingId) redirect(`/${locale}/dashboard/training/${event.relatedTrainingId}`);

  async function update(formData: FormData) {
    "use server";
    await updateCalendarEventAction(id, formData);
  }
  async function remove() {
    "use server";
    await deleteCalendarEventAction(id);
    redirect(`/${locale}/dashboard/calendar`);
  }

  const inputClass = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-club-primary focus:ring-2 focus:ring-club-primary/15 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-club-primary/20 bg-club-primary/10 text-club-primary shadow-sm">
          <Plus className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          {isAr ? "تعديل موعد" : "Modifier le rendez-vous"}
        </h1>
        <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
          {isAr ? "حدّث تفاصيل الموعد ليظهر التعديل في رزنامة النادي." : "Modifiez les détails pour mettre à jour le calendrier du club."}
        </p>
        <Link
          href={`/${locale}/dashboard/calendar`}
          className="mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          <span>{isAr ? "العودة إلى الرزنامة" : "Retour au calendrier"}</span>
        </Link>
      </div>

      <form action={update} className="grid grid-cols-1 gap-x-5 gap-y-5 rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:grid-cols-2 sm:p-7">
        <div className="sm:col-span-2">
          <label htmlFor="calendar-event-title" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.eventTitle")}</label>
          <input id="calendar-event-title" name="title" required maxLength={160} defaultValue={event.title} disabled={!canManage} className={inputClass} />
        </div>
        <div>
          <label htmlFor="calendar-event-type" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.type")}</label>
          <FormSelect
            name="type"
            defaultValue={event.type}
            disabled={!canManage}
            required
            locale={locale}
            ariaLabel={t("fields.type")}
            options={TYPES.map((type) => ({ value: type, label: t(`types.${type}` as any) }))}
          />
        </div>
        <div>
          <label htmlFor="calendar-event-location" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.location")}</label>
          <input id="calendar-event-location" name="location" maxLength={160} defaultValue={event.location ?? ""} disabled={!canManage} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <DateTimeInput label={t("fields.startDateTime")} name="startDateTime" defaultValue={event.startDateTime} required disabled={!canManage} locale={locale} />
        </div>
        <div className="sm:col-span-2">
          <DateTimeInput label={t("fields.endDateTime")} name="endDateTime" defaultValue={event.endDateTime} required disabled={!canManage} locale={locale} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="calendar-event-description" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.description")}</label>
          <textarea id="calendar-event-description" name="description" rows={4} maxLength={2000} defaultValue={event.description ?? ""} disabled={!canManage} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-club-primary focus:ring-2 focus:ring-club-primary/15 disabled:cursor-not-allowed disabled:opacity-60" />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-start">
          <Link href={`/${locale}/dashboard/calendar`} className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            {isAr ? "إلغاء" : "Annuler"}
          </Link>
          {canManage && (
            <Button type="submit" className="h-10 gap-2 rounded-xl px-5 text-xs font-bold shadow-md shadow-club-primary/20">
              <Save className="h-4 w-4" />
              <span>{isAr ? "حفظ الموعد" : "Enregistrer le rendez-vous"}</span>
            </Button>
          )}
        </div>
      </form>

      {canManage && (
        <div className="mt-4 flex justify-end">
          <ConfirmDialog onConfirm={remove}>
            <Button variant="destructive">{tCommon("delete")}</Button>
          </ConfirmDialog>
        </div>
      )}
    </div>
  );
}
