import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FinanceNavTabs } from "@/components/finance/finance-nav-tabs";
import { PieChart, TrendingUp, AlertCircle } from "lucide-react";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { ACTIVE: "success", CLOSED: "neutral" };

export default async function BudgetsListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("finance.view", locale);
  const t = await getTranslations("finance");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "finance.manage");

  const effectiveTeamId = await getEffectiveTeamId(sp.team);

  const [budgets, teams] = await Promise.all([
    db.budget.findMany({
      where: effectiveTeamId ? { teamId: effectiveTeamId } : {},
      include: { season: true, team: true },
      orderBy: { createdAt: "desc" }
    }),
    getAuthorizedTeams()
  ]);

  // Remaining = allocated − Σ(POSTED expenses linked to this budget). Only
  // POSTED expenses are authoritative expenditure (spec section 9) — DRAFT
  // never silently reduces the official budget.
  const spentByBudget = await db.expense.groupBy({
    by: ["budgetId"],
    where: { budgetId: { in: budgets.map((b) => b.id) }, status: "POSTED" },
    _sum: { amount: true }
  });
  const spentMap = new Map(spentByBudget.map((s) => [s.budgetId, s._sum.amount ?? 0] as const));

  const totalAllocated = budgets.reduce((acc, b) => acc + b.allocatedAmount, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + (spentMap.get(b.id) ?? 0), 0);
  const totalRemaining = Math.max(0, totalAllocated - totalSpent);
  const totalPercent = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

  const currencySuffix = locale === "ar" ? " دج" : " DZD";
  const formatMoney = (val: number) => val.toLocaleString(locale) + currencySuffix;

  return (
    <div className="space-y-6">
      <FinanceNavTabs locale={locale} />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("budgets")}</h1>
          <p className="text-sm text-muted-foreground">{locale === "ar" ? "الميزانية العامة للنادي، توزيع المخصصات المالية ومتابعة استهلاكها" : "Budget général du club, répartition et suivi de la consommation des enveloppes"}</p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">{t("overview.allocated")}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{formatMoney(totalAllocated)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{budgets.length} {locale === "ar" ? "ميزانيات محددة" : "lignes budgétaires"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t("overview.spent")}</p>
            <span className={`text-xs font-bold ${totalPercent >= 90 ? "text-amber-600" : "text-emerald-600"}`}>{totalPercent}%</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{formatMoney(totalSpent)}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all ${totalPercent > 100 ? "bg-destructive" : totalPercent >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, totalPercent)}%` }}
            />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">{t("overview.remaining")}</p>
          <p className={`mt-1 text-2xl font-bold ${totalRemaining === 0 && totalSpent > totalAllocated ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
            {formatMoney(totalRemaining)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "الرصيد المتاح للاستهلاك" : "Solde disponible"}</p>
        </div>
      </div>

      {/* Club-wide unified budget note */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-xs text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            {locale === "ar" ? "الميزانية المعتمدة للنادي ككل:" : "Budget global du club:"}
          </span>
          <span>
            {locale === "ar"
              ? "ميزانية موحدة للموسم الرياضي تشمل كافة الفئات والأنشطة بدون تجزئة"
              : "Budget unifié pour l'ensemble des catégories et activités"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-start">{t("fields.season")}</th>
              <th className="px-4 py-2 text-start">{tTeams("title")}</th>
              <th className="px-4 py-2 text-start">{t("fields.category")}</th>
              <th className="px-4 py-2 text-start">{t("fields.allocatedAmount")}</th>
              <th className="px-4 py-2 text-start">{t("fields.spent")}</th>
              <th className="px-4 py-2 text-start">{locale === "ar" ? "نسبة الاستهلاك" : "Consommation"}</th>
              <th className="px-4 py-2 text-start">{t("fields.remaining")}</th>
              <th className="px-4 py-2 text-start">{t("fields.status")}</th>
              <th className="px-4 py-2 text-start">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => {
              const spent = spentMap.get(b.id) ?? 0;
              const remaining = b.allocatedAmount - spent;
              const pct = b.allocatedAmount > 0 ? Math.round((spent / b.allocatedAmount) * 100) : 0;
              return (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">{b.season.label}</td>
                  <td className="px-4 py-3">{b.team ? tTeams(`categories.${b.team.category}` as any) : t("clubWide")}</td>
                  <td className="px-4 py-3">{b.category ? t(`categories.${b.category}` as any) : "—"}</td>
                  <td className="px-4 py-3 font-semibold">{formatMoney(b.allocatedAmount)}</td>
                  <td className="px-4 py-3 font-medium">{formatMoney(spent)}</td>
                  <td className="px-4 py-3 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${pct > 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono font-medium ${pct > 100 ? "text-destructive" : pct >= 80 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {pct}%
                      </span>
                    </div>
                  </td>
                  <td className={`px-4 py-3 font-medium ${remaining < 0 ? "text-destructive font-bold" : "text-foreground"}`}>
                    {formatMoney(remaining)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[b.status]}>{t(`budgetStatuses.${b.status}` as any)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/${locale}/dashboard/finance/budgets/${b.id}`} className="text-club-primary hover:underline text-xs font-medium">
                      {tCommon("edit")}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {budgets.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  {tCommon("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
