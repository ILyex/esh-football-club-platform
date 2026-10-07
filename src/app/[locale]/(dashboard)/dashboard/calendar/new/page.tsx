import Link from "next/link";
import { Plus, ChevronRight, Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePagePermission } from "@/lib/permissions";
import { createCalendarEventAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { FormSelect } from "@/components/ui/form-select";

const TYPES = ["MEETING", "ADMINISTRATIVE", "OTHER"] as const;

export default async function NewCalendarEventPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("calendar.manage", locale);
  const t = await getTranslations("calendar");
  const tCommon = await getTranslations("common");
  const isAr = locale === "ar";

  async function action(formData: FormData) {
    "use server";
    const { startDateTime } = await createCalendarEventAction(formData);
    const month = `${startDateTime.getUTCFullYear()}-${String(startDateTime.getUTCMonth() + 1).padStart(2, "0")}`;
    redirect(`/${locale}/dashboard/calendar?month=${month}&notice=calendarEventCreated`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-club-primary/20 bg-club-primary/10 text-club-primary shadow-sm">
          <Plus className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{t("addEvent")}</h1>
        <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
          {isAr ? "أدخل تفاصيل الموعد ومكانه ووقته ليظهر في رزنامة النادي." : "Renseignez les détails, le lieu et l’horaire pour ajouter ce rendez-vous au calendrier du club."}
        </p>
        <Link
          href={`/${locale}/dashboard/calendar`}
          className="mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          <span>{isAr ? "العودة إلى الرزنامة" : "Retour au calendrier"}</span>
        </Link>
      </div>

      <form action={action} className="grid grid-cols-1 gap-x-5 gap-y-5 rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:grid-cols-2 sm:p-7">
        <div className="sm:col-span-2">
          <label htmlFor="calendar-event-title" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.eventTitle")}</label>
          <input id="calendar-event-title" name="title" required maxLength={160} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
        </div>
        <div>
          <label htmlFor="calendar-event-type" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.type")}</label>
          <FormSelect
            name="type"
            defaultValue="MEETING"
            required
            locale={locale}
            ariaLabel={t("fields.type")}
            options={TYPES.map((ty) => ({ value: ty, label: t(`types.${ty}` as any) }))}
          />
        </div>
        <div>
          <label htmlFor="calendar-event-location" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.location")}</label>
          <input id="calendar-event-location" name="location" maxLength={160} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
        </div>
        <div className="sm:col-span-2">
          <DateTimeInput
            label={t("fields.startDateTime")}
            name="startDateTime"
            required
            locale={locale}
          />
        </div>
        <div className="sm:col-span-2">
          <DateTimeInput
            label={t("fields.endDateTime")}
            name="endDateTime"
            required
            locale={locale}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="calendar-event-description" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.description")}</label>
          <textarea id="calendar-event-description" name="description" rows={4} maxLength={2000} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end">
          <Link href={`/${locale}/dashboard/calendar`} className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            {isAr ? "إلغاء" : "Annuler"}
          </Link>
          <Button type="submit" className="h-10 gap-2 rounded-xl px-5 text-xs font-bold shadow-md shadow-club-primary/20">
            <Save className="h-4 w-4" />
            <span>{isAr ? "حفظ الموعد" : "Enregistrer le rendez-vous"}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
