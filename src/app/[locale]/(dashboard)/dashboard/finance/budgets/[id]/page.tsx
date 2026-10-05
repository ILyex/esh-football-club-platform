import { Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { updateBudgetAction } from "../actions";
import { Button } from "@/components/ui/button";
import { NoticeToast } from "@/components/shared/notice-toast";
import { runFinanceAction, withNotice } from "@/lib/finance/action-notice";

const CATEGORIES = ["FOOD", "TRANSPORT", "LODGING", "EQUIPMENT", "MEDICAL", "ADMINISTRATION", "TRAINING", "MATCH", "TRAVEL", "OTHER"] as const;

export default async function BudgetDetailPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { locale, id } = await params;
  const { notice } = await searchParams;
  const user = await requirePermission("finance.view");
  const t = await getTranslations("finance");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "finance.manage");

  const [budget, seasons, teams] = await Promise.all([
    db.budget.findUnique({ where: { id }, include: { season: true, team: true, expenses: { orderBy: { date: "desc" } } } }),
    db.season.findMany({ orderBy: { startDate: "desc" } }),
    db.team.findMany({ orderBy: { category: "asc" } })
  ]);
  if (!budget) notFound();

  const spent = budget.expenses.filter((e) => e.status === "POSTED").reduce((sum, e) => sum + e.amount, 0);
  const remaining = budget.allocatedAmount - spent;
  const utilization = budget.allocatedAmount > 0 ? Math.round((spent / budget.allocatedAmount) * 100) : 0;

  async function update(formData: FormData) {
    "use server";
    const result = await runFinanceAction(() => updateBudgetAction(id, formData));
    if (!result.ok) redirect(withNotice(`/${locale}/dashboard/finance/budgets/${id}`, result.notice));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <NoticeToast notice={notice} />
      <h1 className="text-xl font-semibold">
        {budget.season.label} — {budget.team ? tTeams(`categories.${budget.team.category}` as any) : t("clubWide")}
      </h1>

      <div className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-card p-4 text-center text-sm">
        <div>
          <p className="text-xl font-semibold">{budget.allocatedAmount.toLocaleString(locale)}</p>
          <p className="text-xs text-muted-foreground">{t("fields.allocatedAmount")}</p>
        </div>
        <div>
          <p className="text-xl font-semibold">{spent.toLocaleString(locale)}</p>
          <p className="text-xs text-muted-foreground">{t("fields.spent")}</p>
        </div>
        <div>
          <p className={`text-xl font-semibold ${remaining < 0 ? "text-destructive" : ""}`}>{remaining.toLocaleString(locale)}</p>
          <p className="text-xs text-muted-foreground">
            {t("fields.remaining")} ({utilization}%)
          </p>
        </div>
      </div>

      {remaining < 0 && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {t("budgetExceededNote", { amount: (-remaining).toLocaleString(locale) })}
        </p>
      )}

      <form action={update} className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.season")}</label>
          <select name="seasonId" defaultValue={budget.seasonId} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{tTeams("title")}</label>
          <select name="teamId" defaultValue={budget.teamId ?? ""} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
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
          <select name="category" defaultValue={budget.category ?? ""} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
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
          <input name="allocatedAmount" type="number" min={1} step={1} defaultValue={budget.allocatedAmount} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.status")}</label>
          <select name="status" defaultValue={budget.status} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
            <option value="ACTIVE">{t("budgetStatuses.ACTIVE")}</option>
            <option value="CLOSED">{t("budgetStatuses.CLOSED")}</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.notes")}</label>
          <textarea name="notes" rows={3} defaultValue={budget.notes ?? ""} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        {canManage && (
          <div className="col-span-2">
            <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
          </div>
        )}
      </form>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">{t("expenses")}</h2>
        <ul className="divide-y divide-border text-sm">
          {budget.expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2">
              <a href={`/${locale}/dashboard/finance/expenses/${e.id}`} className="text-club-primary underline">
                {e.description}
              </a>
              <span>
                {e.amount.toLocaleString(locale)} — {t(`expenseStatuses.${e.status}` as any)}
              </span>
            </li>
          ))}
          {budget.expenses.length === 0 && <li className="py-2 text-muted-foreground">{tCommon("noResults")}</li>}
        </ul>
      </div>
    </div>
  );
}
