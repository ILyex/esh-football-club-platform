import { Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { getCurrentTeamId } from "@/lib/team-context";
import { createBudgetAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

const CATEGORIES = ["FOOD", "TRANSPORT", "LODGING", "EQUIPMENT", "MEDICAL", "ADMINISTRATION", "TRAINING", "MATCH", "TRAVEL", "OTHER"] as const;

export default async function NewBudgetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePermission("finance.manage");
  const t = await getTranslations("finance");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const [seasons, teams, currentTeamId] = await Promise.all([
    db.season.findMany({ orderBy: { startDate: "desc" } }),
    db.team.findMany({ orderBy: { category: "asc" } }),
    getCurrentTeamId()
  ]);

  async function action(formData: FormData) {
    "use server";
    const { id } = await createBudgetAction(formData);
    redirect(`/${locale}/dashboard/finance/budgets/${id}`);
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-xl font-semibold">{t("addBudget")}</h1>
      <form action={action} className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6">
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
          <label className="mb-1 block text-sm font-medium">{tTeams("title")}</label>
          <select name="teamId" defaultValue={currentTeamId ?? ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">{t("clubWide")}</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tTeams(`categories.${tm.category}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.category")}</label>
          <select name="category" defaultValue="" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.allocatedAmount")}</label>
          <input name="allocatedAmount" type="number" min={1} step={1} required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.status")}</label>
          <select name="status" defaultValue="ACTIVE" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="ACTIVE">{t("budgetStatuses.ACTIVE")}</option>
            <option value="CLOSED">{t("budgetStatuses.CLOSED")}</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.notes")}</label>
          <textarea name="notes" rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2">
          <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
        </div>
      </form>
    </div>
  );
}
