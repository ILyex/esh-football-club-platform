import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getAccountBalances } from "@/lib/finance/treasury-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FinanceNavTabs } from "@/components/finance/finance-nav-tabs";
import { TreasuryCashflowChart } from "@/components/finance/treasury-cashflow-chart";
import { EditOpeningBalanceModal } from "@/components/finance/edit-opening-balance-modal";
import { FinancialOperationsTable, type UnifiedFinancialOperation } from "@/components/finance/financial-operations-table";
import {
  Wallet,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus,
  FileCheck,
  AlertTriangle,
  Landmark
} from "lucide-react";
import { calculateClubDebtSummary } from "@/lib/finance/debt-service";

export const dynamic = "force-dynamic";

export default async function FinanceOverviewPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await searchParams;
  const { locale } = await params;
  const user = await requirePagePermission("finance.view", locale);
  const canManage = hasPermission(user, "finance.manage");
  const canApprove = hasPermission(user, "finance.approve");
  const isProgrammer =
    user.permissions.includes("*") ||
    user.roleKey === "super_admin" ||
    user.email === "admin@esh.dz" ||
    user.email.includes("dev") ||
    user.roleKey === "developer" ||
    hasPermission(user, "finance.subsidies");

  const t = await getTranslations("finance");
  const tCommon = await getTranslations("common");

  // 1. Current season
  const currentSeason = await db.season.findFirst({ where: { isCurrent: true } });

  // 2. Central Treasury Account & Balances (Club-wide strictly: Single account for all categories)
  const treasuryAccounts = await db.treasuryAccount.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" }
  });

  const primaryAccount = treasuryAccounts[0] || null;
  const accountBalances = await getAccountBalances(treasuryAccounts.map((a) => a.id));
  let totalTreasuryBalance = 0;
  for (const acc of treasuryAccounts) {
    totalTreasuryBalance += accountBalances.get(acc.id) ?? 0;
  }

  // 3. Central Financial Aggregates: Deposits, Withdrawals, Expenses (No categories separation)
  const [
    depositsAgg,
    withdrawalsAgg,
    postedExpenseAgg,
    draftExpenseAgg,
    allTransactions,
    recentTransactions,
    recentExpenses
  ] = await Promise.all([
    // Deposits (دولة/بلدية، ديون، رعاة، اشتراكات)
    db.treasuryTransaction.aggregate({
      where: { type: "DEPOSIT" },
      _count: { id: true },
      _sum: { amount: true }
    }),
    // Withdrawals (سحوبات نقدية بوصل سحب)
    db.treasuryTransaction.aggregate({
      where: { type: "WITHDRAWAL" },
      _count: { id: true },
      _sum: { amount: true }
    }),
    // Posted Expenses (مصاريف مبررة بفواتير)
    db.expense.aggregate({
      where: { status: "POSTED" },
      _count: { id: true },
      _sum: { amount: true }
    }),
    // Draft Expenses (مسودات قيد المراجعة)
    db.expense.aggregate({
      where: { status: "DRAFT" },
      _count: { id: true },
      _sum: { amount: true }
    }),
    // All transactions for Cashflow Chart
    db.treasuryTransaction.findMany({
      orderBy: { transactionDate: "asc" },
      select: {
        id: true,
        type: true,
        amount: true,
        transactionDate: true,
        description: true
      }
    }),
    // Recent ledger movements
    db.treasuryTransaction.findMany({
      take: 50,
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      include: {
        treasuryAccount: true,
        relatedExpense: true
      }
    }),
    // Recent expenses
    db.expense.findMany({
      where: { status: "POSTED" },
      take: 50,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        team: true,
        document: true
      }
    })
  ]);

  const totalPostedAmount = postedExpenseAgg._sum.amount ?? 0;
  const totalWithdrawnAmount = withdrawalsAgg._sum.amount ?? 0;
  const debtSummary = await calculateClubDebtSummary();
  const isDebt = debtSummary.hasDebt;
  const debtAmount = debtSummary.debtAmount;

  const currencySuffix = locale === "ar" ? " د.ج" : " DZD";
  const formatMoney = (amount: number) => amount.toLocaleString(locale) + currencySuffix;

  // Helper to merge calendar date with time accurately
  const getOpDateTime = (targetDate: Date, createdAt: Date) => {
    const d = new Date(targetDate);
    const c = new Date(createdAt);
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
      d.setHours(c.getHours(), c.getMinutes(), c.getSeconds(), c.getMilliseconds());
    }
    return {
      iso: d.toISOString(),
      timestamp: d.getTime()
    };
  };

  // Helper to extract [المعني: ...] and [CNI: ...] tags from description
  const parseDescMetadata = (desc?: string | null) => {
    let beneficiary = "";
    let nationalId = "";
    let cleanDesc = desc || "";
    if (desc) {
      const benMatch = desc.match(/\[(?:المعني|Bénéficiaire):\s*([^\]]+)\]/);
      if (benMatch) beneficiary = benMatch[1]?.trim() || "";
      const cniMatch = desc.match(/\[(?:CNI|ب\.ت\.و):\s*([^\]]+)\]/);
      if (cniMatch) nationalId = cniMatch[1]?.trim() || "";
      cleanDesc = desc
        .replace(/\[(?:المعني|Bénéficiaire):\s*([^\]]+)\]/g, "")
        .replace(/\[(?:CNI|ب\.ت\.و):\s*([^\]]+)\]/g, "")
        .trim();
    }
    return { beneficiary, nationalId, cleanDesc };
  };

  // Build unified financial operations list (Deposits, Withdrawals, Expenses) sorted strictly by Date & Time
  const unifiedOperations: UnifiedFinancialOperation[] = [
    ...recentTransactions.map((tx) => {
      const dt = getOpDateTime(tx.transactionDate, tx.createdAt);
      const meta = parseDescMetadata(tx.description);
      return {
        id: tx.id,
        type: tx.type as "DEPOSIT" | "WITHDRAWAL",
        referenceNumber: tx.referenceNumber || tx.relatedExpense?.referenceNumber || tx.id.slice(0, 8).toUpperCase(),
        date: dt.iso,
        timestamp: dt.timestamp,
        amount: tx.amount,
        description: meta.cleanDesc || tx.relatedExpense?.description || (tx.type === "DEPOSIT" ? (locale === "ar" ? "إيداع رسمي" : "Dépôt officiel") : (locale === "ar" ? "سحب رسمي" : "Retrait officiel")),
        subtext: tx.treasuryAccount?.name || "",
        accountName: tx.treasuryAccount?.name,
        treasuryAccountId: tx.treasuryAccountId,
        beneficiary: meta.beneficiary || tx.relatedExpense?.payeeName || undefined,
        nationalIdNumber: meta.nationalId || undefined,
        documentId: null,
        documentName: null
      };
    }),
    ...recentExpenses.map((exp) => {
      const dt = getOpDateTime(exp.date, exp.createdAt);
      return {
        id: exp.id,
        type: "EXPENSE" as const,
        referenceNumber: exp.referenceNumber,
        date: dt.iso,
        timestamp: dt.timestamp,
        amount: exp.amount,
        description: exp.description,
        subtext: exp.team?.name || (locale === "ar" ? "مصاريف إدارية وتشغيلية" : "Frais de gestion"),
        accountName: undefined,
        treasuryAccountId: undefined,
        beneficiary: exp.payeeName || undefined,
        nationalIdNumber: undefined,
        documentId: exp.document?.id || exp.documentId || null,
        documentName: exp.document?.name || (locale === "ar" ? "فاتورة / وصل قانوني" : "Facture légale")
      };
    })
  ].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="space-y-6">
      <FinanceNavTabs locale={locale} />

      {/* Top Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {locale === "ar" ? "الإدارة المالية" : "Finances"}
        </h1>
      </div>

      {/* Debt Warning Banner */}
      {isDebt && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/50 bg-gradient-to-r from-red-500/15 via-red-500/10 to-amber-500/10 p-5 shadow-md">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-red-600 dark:text-red-400">
                  {locale === "ar" ? "تنبيه مالي: توجد فواتير وديون معلقة غير مسددة" : "Alerte Financière : Dettes en attente de règlement"}
                </h3>
                <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-0.5 text-xs font-black text-white shadow-xs">
                  {locale === "ar" ? `إجمالي الديون: ${formatMoney(debtAmount)}` : `Dette : ${formatMoney(debtAmount)}`}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
                {locale === "ar"
                  ? `هذا الرصيد يجمع المصروفات المعتمدة المسجلة كديون ولم يُسجل لها سداد من الخزينة. إيداع مبلغ في الصندوق أو تحويله من البنك لا يسدد الدين تلقائياً.`
                  : `Ce solde regroupe les dépenses validées enregistrées comme dettes sans paiement associé dans la trésorerie. Un transfert vers la caisse ne règle pas automatiquement ces dettes.`}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href={`/${locale}/dashboard/finance/expenses`}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  {locale === "ar" ? "معاينة سجل المصاريف والديون ←" : "Consulter le registre des dettes ←"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Central Treasury Account Banner with Opening Balance Modification */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-background p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  {primaryAccount?.name || (locale === "ar" ? "الحساب البنكي المركزي للنادي" : "Compte Bancaire Central")}
                </h2>
                <span className="inline-flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-1" title={locale === "ar" ? "حساب رسمي معتمد" : "Compte Officiel"}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <span>{locale === "ar" ? "الموسم الرياضي:" : "Saison sportive :"}</span>
                <span className="font-semibold text-foreground">
                  {currentSeason ? currentSeason.label : "2025/2026"}
                </span>
              </div>
            </div>
          </div>

          {/* Programmer Only Edit Opening Balance Button */}
          {primaryAccount && isProgrammer && (
            <EditOpeningBalanceModal
              accountId={primaryAccount.id}
              accountName={primaryAccount.name}
              currentBalance={primaryAccount.openingBalance}
              locale={locale}
            />
          )}
        </div>
      </div>

      {/* The 5 Core Pillars: 1. البنك | 2. الصندوق | 3. الإيداعات | 4. السحوبات | 5. المصاريف */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Pillar 1: البنك (Bank Account) - Blue */}
        <div className="flex flex-col justify-between rounded-2xl border border-blue-500/20 bg-card p-4 shadow-xs hover:border-blue-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                {locale === "ar" ? "1. البنك (الحساب البنكي)" : "1. Banque (BNA)"}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
              {formatMoney(primaryAccount ? (accountBalances.get(primaryAccount.id) ?? primaryAccount.openingBalance) : 0)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground truncate" title={primaryAccount?.name}>
              {primaryAccount?.name || (locale === "ar" ? "الحساب البنكي الرسمي" : "Compte BNA")}
            </p>
          </div>
          <Link href={`/${locale}/dashboard/finance/treasury?view=BANK`} className="mt-3">
            <Button variant="outline" size="sm" className="w-full text-xs h-8 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-semibold">
              <span>{locale === "ar" ? "تفاصيل البنك ←" : "Grand livre ←"}</span>
            </Button>
          </Link>
        </div>

        {/* Pillar 2: الصندوق (Cash / Caisse) - Teal */}
        <div className="flex flex-col justify-between rounded-2xl border border-teal-500/20 bg-card p-4 shadow-xs hover:border-teal-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                {locale === "ar" ? "2. الصندوق (السيولة)" : "2. Caisse (Espèces)"}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-teal-600 dark:text-teal-400">
              {formatMoney(
                treasuryAccounts.find((a) => a.type === "CASH")
                  ? (accountBalances.get(treasuryAccounts.find((a) => a.type === "CASH")!.id) ?? 0)
                  : Math.max(0, totalWithdrawnAmount - totalPostedAmount)
              )}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {locale === "ar" ? "السيولة النقدية المتوفرة بالصندوق" : "Espèces disponibles"}
            </p>
          </div>
          <Link href={`/${locale}/dashboard/finance/treasury?view=CASH`} className="mt-3">
            <Button variant="outline" size="sm" className="w-full text-xs h-8 border-teal-500/30 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 font-semibold">
              <span>{locale === "ar" ? "سجل الصندوق ←" : "Caisse ←"}</span>
            </Button>
          </Link>
        </div>

        {/* Pillar 3: الإيداعات (Deposits) - Emerald */}
        <div className="flex flex-col justify-between rounded-2xl border border-emerald-500/20 bg-card p-4 shadow-xs hover:border-emerald-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                {locale === "ar" ? "3. الإيداعات" : "3. Dépôts"}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              +{formatMoney(depositsAgg._sum.amount ?? 0)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {depositsAgg._count.id} {locale === "ar" ? "عملية إيداع بوصل رسمي" : "dépôts certifiés"}
            </p>
          </div>
          {(canApprove || isProgrammer) && primaryAccount && (
            <Link href={`/${locale}/dashboard/finance/treasury/${primaryAccount.id}?action=deposit`} className="mt-3">
              <Button size="sm" className="w-full text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                <ArrowDownLeft className="h-4 w-4 shrink-0" />
                <span>{locale === "ar" ? "تسجيل إيداع" : "Nouveau dépôt"}</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Pillar 4: السحوبات (Withdrawals / Outflow) - Amber */}
        <div className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-card p-4 shadow-xs hover:border-amber-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                {locale === "ar" ? "4. السحوبات (نقد)" : "4. Retraits"}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              -{formatMoney(withdrawalsAgg._sum.amount ?? 0)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {withdrawalsAgg._count.id} {locale === "ar" ? "عملية سحب بوصل رسمي" : "retraits autorisés"}
            </p>
          </div>
          {(canApprove || isProgrammer) && primaryAccount && (
            <Link href={`/${locale}/dashboard/finance/treasury/${primaryAccount.id}?action=withdrawal`} className="mt-3">
              <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1.5 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 font-semibold">
                <ArrowUpRight className="h-4 w-4 shrink-0" />
                <span>{locale === "ar" ? "تسجيل سحب" : "Nouveau retrait"}</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Pillar 5: المصاريف (Expenses / Invoices) - Red */}
        <div className="flex flex-col justify-between rounded-2xl border border-red-500/20 bg-card p-4 shadow-xs hover:border-red-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-700 dark:text-red-400">
                {locale === "ar" ? "5. المصاريف (الصرف)" : "5. Dépenses (Factures)"}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-red-600 dark:text-red-400">
              {formatMoney(totalPostedAmount)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {postedExpenseAgg._count.id} {locale === "ar" ? "فاتورة معتمدة ومبررة" : "factures validées"}
            </p>
          </div>
          {canManage && (
            <Link href={`/${locale}/dashboard/finance/expenses?showNew=expense`} className="mt-3">
              <Button variant="outline" size="sm" className="w-full text-xs h-8 border-red-500/40 text-red-600 hover:bg-red-500/10 font-semibold">
                <span>{locale === "ar" ? "+ تسجيل صرف" : "+ Engager dépense"}</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Treasury Cashflow Chart */}
      <div className="w-full">
        <TreasuryCashflowChart transactions={allTransactions} locale={locale} />
      </div>

      {/* Unified Financial Operations Table (Deposits, Withdrawals, Expenses) */}
      <FinancialOperationsTable
        operations={unifiedOperations}
        locale={locale}
        isProgrammer={isProgrammer}
        accounts={treasuryAccounts.map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
