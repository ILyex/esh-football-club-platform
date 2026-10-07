import Link from "next/link";
import { Clock3, MapPin, Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { getCurrentTeamId } from "@/lib/team-context";
import { createTrainingSessionAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { TimeInput } from "@/components/ui/time-input";
import { TrainingTeamCoachFields } from "@/components/training/training-team-coach-fields";

export default async function NewTrainingSessionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("training.manage", locale);
  const t = await getTranslations("training");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const [coaches, teams, currentTeamId] = await Promise.all([
    db.staff.findMany({
        where: { role: { in: ["HEAD_COACH", "ASSISTANT_COACH", "GOALKEEPING_COACH", "FITNESS_COACH"] }, status: "ACTIVE" },
        include: { teamAssignments: { select: { teamId: true } } },
      orderBy: { lastName: "asc" }
    }),
    db.team.findMany({ orderBy: { category: "asc" } }),
    getCurrentTeamId()
  ]);

  async function action(formData: FormData) {
    "use server";
    const { id } = await createTrainingSessionAction(formData);
    redirect(`/${locale}/dashboard/training/${id}`);
  }

  const isAr = locale === "ar";
  const selectOptions = teams.map((tm) => ({
    id: tm.id,
    label: tTeams(`categories.${tm.category}` as any)
  }));
  const coachOptions = coaches.map((coach) => ({
    id: coach.id,
    label: `${coach.firstName} ${coach.lastName}`.trim(),
    teamIds: [coach.teamId, ...coach.teamAssignments.map((assignment) => assignment.teamId)].filter((id): id is string => Boolean(id))
  }));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold text-club-primary">{t("title")}</p>
          <h1 className="text-xl font-bold">{t("addSession")}</h1>
        </div>
        <Link href={`/${locale}/dashboard/training`} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          {isAr ? "العودة إلى سجل التدريبات" : "Retour aux entraînements"}
        </Link>
      </div>

      <form action={action} className="grid grid-cols-1 gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2 sm:p-7">
        <TrainingTeamCoachFields
          teams={selectOptions}
          coaches={coachOptions}
          initialTeamId={currentTeamId ?? ""}
          locale={locale}
          teamLabel={tTeams("title")}
          coachLabel={t("fields.coach")}
          teamPlaceholder={isAr ? "اختر الفئة" : "Choisir une catégorie"}
          coachPlaceholder={isAr ? "اختر المدرب (اختياري)" : "Choisir l’entraîneur (facultatif)"}
          teamHeader={isAr ? "الفئة الرياضية" : "Catégorie sportive"}
          coachHeader={isAr ? "المدربون المتاحون لهذه الفئة" : "Entraîneurs de cette catégorie"}
        />
        <div>
          <DateInput
            label={t("fields.date")}
            name="date"
            required
            locale={locale}
          />
        </div>
        <div>
          <label className="mb-1 flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-club-primary" />{t("fields.startTime")}</label>
          <TimeInput name="startTime" required locale={locale} />
        </div>
        <div>
          <label className="mb-1 flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-club-primary" />{t("fields.endTime")}</label>
          <TimeInput name="endTime" required locale={locale} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-club-primary" />{t("fields.location")}</label>
          <input name="location" maxLength={160} placeholder={isAr ? "مثال: الملعب البلدي" : "Ex. : Stade municipal"} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/20" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.notes")}</label>
          <textarea name="notes" rows={3} maxLength={2000} placeholder={isAr ? "ملاحظات تنظيمية اختيارية" : "Notes d’organisation (facultatif)"} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/20" />
        </div>
        <div className="col-span-2 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isAr
              ? "الحصة المبرمجة تظهر تلقائيًا في كاروسيل التدريبات القادمة بالموقع العام، ما دامت بتاريخ اليوم أو بعده."
              : "Une séance programmée apparaît automatiquement dans le carrousel public des prochains entraînements si sa date est aujourd’hui ou ultérieure."}
          </p>
          <Button type="submit" className="shrink-0 gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
        </div>
      </form>
    </div>
  );
}
