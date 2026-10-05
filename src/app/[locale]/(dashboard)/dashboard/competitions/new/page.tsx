import { Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { getCurrentTeamId } from "@/lib/team-context";
import { createCompetitionAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function NewCompetitionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePermission("competitions.manage");
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
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">{tCommon("noResults")}</p>
      ) : (
        <form action={action} className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium">{t("fields.name")}</label>
            <input name="name" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{tTeams("title")}</label>
            <select name="teamId" required defaultValue={currentTeamId ?? ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
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
