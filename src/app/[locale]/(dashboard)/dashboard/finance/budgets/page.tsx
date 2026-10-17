import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Plus, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId } from "@/lib/team-context";
import { FinanceNavTabs } from "@/components/finance/finance-nav-tabs";
import { Button } from "@/components/ui/button";

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

  const budgets = await db.budget.findMany({
    where: effectiveTeamId ? { teamId: effectiveTeamId } : {},
    include: { season: true, team: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });

  const spentByBudget = budgets.length > 0
    ? await db.expense.groupBy({
        by: ["budgetId"],
        where: { budgetId: { in: budgets.map((budget) => budget.id) }, status: "POSTED" },
        _sum: { amount: true }
      })
    : [];
  const spentMap = new Map(spentByBudget.map((item) => [item.budgetId, item._sum.amount ?? 0] as const));
  const allocated = budgets.reduce((sum, budget) => sum + budget.allocatedAmount, 0);
  const spent = budgets.reduce((sum, budget) => sum + (spentMap.get(budget.id) ?? 0), 0);
  const remaining = allocated - spent;
  const utilization = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
  const barWidth = Math.min(100, Math.max(0, utilization));
  const currencySuffix = locale === "ar" ? " د.ج" : " DZD";
  const formatMoney = (value: number) => `${value.toLocaleString(locale)}${currencySuffix}`;
  const primaryBudget = budgets[0];

  return (
    <div className="space-y-6">
      <FinanceNavTabs locale={locale} />

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("budgets")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {locale === "ar" ? "متابعة ميزانية الفريق ومصاريفه في ملخص واحد." : "Suivez le budget et les dépenses de l’équipe dans un seul aperçu."}
          </p>
        </div>
        {primaryBudget ? (
          <Link href={`/${locale}/dashboard/finance/budgets/${primaryBudget.id}`}>
            <Button variant="outline" className="gap-2">
              <ArrowUpRight className="h-4 w-4" />
              {locale === "ar" ? (canManage ? "إدارة الميزانية" : "تفاصيل الميزانية") : (canManage ? "Gérer le budget" : "Détails du budget")}
            </Button>
          </Link>
        ) : canManage ? (
          <Link href={`/${locale}/dashboard/finance/budgets/new`}>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {locale === "ar" ? "إعداد الميزانية" : "Configurer le budget"}
            </Button>
          </Link>
        ) : null}
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        {budgets.length > 0 ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-bold text-foreground">{locale === "ar" ? "ملخص الميزانية" : "Résumé du budget"}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {primaryBudget?.season.label} · {primaryBudget?.team ? tTeams(`categories.${primaryBudget.team.category}` as any) : t("clubWide")}
                    {budgets.length > 1 && ` · ${budgets.length} ${locale === "ar" ? "تخصيصات ضمن الملخص" : "lignes incluses"}`}
                  </p>
                </div>
              </div>
              {remaining < 0 && (
                <span className="rounded-full border border-destructive/25 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                  {locale === "ar" ? "تجاوزت المصروفات المخصص" : "Dépassement du budget"}
                </span>
              )}
            </div>

            <div className="grid gap-5 py-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">{t("overview.allocated")}</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{formatMoney(allocated)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("overview.spent")}</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{formatMoney(spent)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("overview.remaining")}</p>
                <p className={`mt-1 text-xl font-bold tabular-nums ${remaining < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {formatMoney(remaining)}
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-border/70 pt-4">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{locale === "ar" ? "نسبة الصرف" : "Taux de dépense"}</span>
                <span className={`font-mono font-bold tabular-nums ${utilization > 100 ? "text-destructive" : "text-foreground"}`}>{utilization}%</span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={locale === "ar" ? "نسبة صرف الميزانية" : "Taux de dépense du budget"}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={barWidth}
              >
                <div className={`h-full rounded-full transition-all ${utilization > 100 ? "bg-destructive" : utilization >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${barWidth}%` }} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Wallet className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">{locale === "ar" ? "لم تُسجّل ميزانية بعد" : "Aucun budget n’est configuré"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "ar" ? "أعد الميزانية السنوية مرة واحدة لتظهر متابعة المصروفات هنا." : "Configurez le budget annuel pour suivre les dépenses ici."}
              </p>
            </div>
            {canManage && (
              <Link href={`/${locale}/dashboard/finance/budgets/new`}>
                <Button className="gap-2"><Plus className="h-4 w-4" />{locale === "ar" ? "إعداد الميزانية" : "Configurer le budget"}</Button>
              </Link>
            )}
            {!canManage && <span className="text-xs text-muted-foreground">{tCommon("noResults")}</span>}
          </div>
        )}
      </section>
    </div>
  );
}
