import { Save } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { getCurrentTeamId } from "@/lib/team-context";
import { createCompetitionAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

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
    <div className="max-w-xl">
      <h1 className="mb-4 text-xl font-semibold">{t("addCompetition")}</h1>
      {seasons.length === 0 ? (
        <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
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
            className="mt-4 inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {locale === "ar" ? "إنشاء موسم رياضي" : "Créer une saison"}
          </Link>
        </section>
      ) : (
        <form action={action} className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium">{t("fields.name")}</label>
            <input name="name" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {tTeams("title")} <span className="text-muted-foreground">({locale === "ar" ? "اختياري" : "optionnel"})</span>
            </label>
            <select name="teamId" defaultValue={currentTeamId ?? ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="" disabled>
                —
              </option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tTeams(`categories.${tm.category}` as any)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("fields.season")}</label>
            <select name="seasonId" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{locale === "ar" ? "نوع المسابقة" : "Type de compétition"}</label>
            <select name="type" defaultValue="LEAGUE" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="LEAGUE">{locale === "ar" ? "الدوري" : "Championnat (Ligue)"}</option>
              <option value="CUP">{locale === "ar" ? "كأس الجزائر" : "Coupe d'Algérie"}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("fields.status")}</label>
            <select name="status" defaultValue="UPCOMING" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              {["UPCOMING", "ONGOING", "FINISHED"].map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}` as any)}
                </option>
              ))}
            </select>
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
