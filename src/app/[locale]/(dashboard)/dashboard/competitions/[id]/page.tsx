import { Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { updateCompetitionAction } from "../actions";
import { Button } from "@/components/ui/button";

export default async function CompetitionDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requirePagePermission("competitions.view", locale);
  const t = await getTranslations("competitions");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "competitions.manage");

  const [competition, seasons, teams] = await Promise.all([
    db.competition.findUnique({ where: { id }, include: { matches: { orderBy: { matchDate: "desc" }, take: 10 } } }),
    db.season.findMany({ orderBy: { startDate: "desc" } }),
    db.team.findMany({ orderBy: { category: "asc" } })
  ]);
  if (!competition) notFound();

  async function update(formData: FormData) {
    "use server";
    await updateCompetitionAction(id, formData);
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-xl font-semibold">{competition.name}</h1>

      <form action={update} className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.name")}</label>
          <input
            name="name"
            defaultValue={competition.name}
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{tTeams("title")}</label>
          <select
            name="teamId"
            defaultValue={competition.teamId ?? ""}
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tTeams(`categories.${tm.category}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.season")}</label>
          <select
            name="seasonId"
            defaultValue={competition.seasonId}
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{locale === "ar" ? "نوع المسابقة" : "Type"}</label>
          <select
            name="type"
            defaultValue={competition.type}
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            <option value="LEAGUE">{locale === "ar" ? "الدوري" : "Championnat"}</option>
            <option value="CUP">{locale === "ar" ? "كأس الجزائر" : "Coupe d'Algérie"}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.status")}</label>
          <select
            name="status"
            defaultValue={competition.status}
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            {["UPCOMING", "ONGOING", "FINISHED"].map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.organization")}</label>
          <input
            name="organization"
            defaultValue={competition.organization ?? ""}
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{locale === "ar" ? "رابط الشعار" : "URL du logo"}</label>
          <input
            name="logoUrl"
            defaultValue={competition.logoUrl ?? ""}
            disabled={!canManage}
            placeholder="https://..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
        {canManage && (
          <div className="col-span-2">
            <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
          </div>
        )}
      </form>

      <p className="mt-4 text-sm text-muted-foreground">{competition.matches.length} matches</p>
    </div>
  );
}
