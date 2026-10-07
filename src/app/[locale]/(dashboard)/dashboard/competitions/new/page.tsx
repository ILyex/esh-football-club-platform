import { Save } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { getCurrentTeamId } from "@/lib/team-context";
import { createCompetitionAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";

export default async function NewCompetitionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("competitions.manage", locale);
  const t = await getTranslations("competitions");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const [seasons, teams, currentTeamId] = await Promise.all([
    db.season.findMany({ orderBy: { startDate: "desc" } }),
    db.team.findMany({ orderBy: { category: "asc" } }),
    getCurrentTeamId()
  ]);

  async function action(formData: FormData) {
    "use server";
    const { id } = await createCompetitionAction(formData);
    redirect(`/${locale}/dashboard/competitions/${id}`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-0">
      <h1 className="mb-6 text-center text-2xl font-bold tracking-tight">{locale === "ar" ? "إنشاء مسابقة" : "Créer une compétition"}</h1>
      {seasons.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
          <h2 className="font-bold text-foreground">
            {locale === "ar" ? "أنشئ الموسم الرياضي أولاً" : "Créez d’abord une saison"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {locale === "ar"
              ? "كل مسابقة يجب أن تكون مرتبطة بموسم. افتح صفحة المسابقات وأنشئ الموسم من نموذج «إضافة موسم»، ثم ارجع لإضافة المسابقة."
              : "Chaque compétition doit être liée à une saison. Ouvrez la page des compétitions, créez une saison, puis revenez ajouter la compétition."}
          </p>
          <Link
            href={`/${locale}/dashboard/competitions#season-creator`}
            className="mt-6 inline-flex min-h-10 items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            {locale === "ar" ? "إنشاء موسم رياضي" : "Créer une saison"}
          </Link>
        </section>
      ) : (
        <form action={action} className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium">{t("fields.name")}</label>
            <input name="name" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {tTeams("title")} <span className="text-muted-foreground">({locale === "ar" ? "اختياري" : "optionnel"})</span>
            </label>
            <FormSelect
              name="teamId"
              defaultValue={currentTeamId ?? ""}
              locale={locale}
              placeholder="—"
              ariaLabel={tTeams("title")}
              options={teams.map((tm) => ({ id: tm.id, label: tTeams(`categories.${tm.category}` as any) })).map((option) => ({ value: option.id, label: option.label }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("fields.season")}</label>
            <FormSelect
              name="seasonId"
              required
              defaultValue={seasons[0]?.id ?? ""}
              locale={locale}
              ariaLabel={t("fields.season")}
              options={seasons.map((s) => ({ value: s.id, label: s.label }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{locale === "ar" ? "نوع المسابقة" : "Type de compétition"}</label>
            <FormSelect
              name="type"
              defaultValue="LEAGUE"
              locale={locale}
              ariaLabel={locale === "ar" ? "نوع المسابقة" : "Type de compétition"}
              options={[{ value: "LEAGUE", label: locale === "ar" ? "الدوري" : "Championnat (Ligue)" }, { value: "CUP", label: locale === "ar" ? "كأس الجزائر" : "Coupe d'Algérie" }]}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("fields.status")}</label>
            <FormSelect
              name="status"
              defaultValue="UPCOMING"
              locale={locale}
              ariaLabel={t("fields.status")}
              options={["UPCOMING", "ONGOING", "FINISHED"].map((value) => ({ value, label: t(`statuses.${value}` as any) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("fields.organization")}</label>
            <input name="organization" placeholder={locale === "ar" ? "مثال: الرابطة الجهوية سعيدة / FAF" : "ex: LRF Saida / FAF"} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{locale === "ar" ? "رابط شعار المسابقة (اختياري)" : "URL du logo (optionnel)"}</label>
            <input name="logoUrl" placeholder="https://..." className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
          </div>
        </form>
      )}
    </div>
  );
}
