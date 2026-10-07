import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { runFinanceAction, withNotice } from "@/lib/finance/action-notice";
import { createExpenseAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NoticeToast } from "@/components/shared/notice-toast";
import { FinanceNavTabs } from "@/components/finance/finance-nav-tabs";
import { ExpenseVsWithdrawalsChart } from "@/components/finance/expense-vs-withdrawals-chart";
import { ClubExpensesTable, type ClubExpenseItem } from "@/components/finance/club-expenses-table";
import { Receipt, Paperclip, Download, FileText, CheckCircle2 } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { FINANCE_COLORS } from "@/lib/finance/colors";

export default async function ExpensesListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string; status?: string; notice?: string; showNew?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("finance.view", locale);
  const t = await getTranslations("finance");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "finance.manage");

  const effectiveTeamId = await getEffectiveTeamId(sp.team);
  const where = {
    ...(effectiveTeamId ? { teamId: effectiveTeamId } : {})
  };

  const [expenses, teams, withdrawals, allExpensesForChart, seasons, budgets] = await Promise.all([
    db.expense.findMany({
      where,
      include: { team: true, document: true, treasuryTransaction: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200
    }),
    getAuthorizedTeams(),
    db.treasuryTransaction.findMany({
      where: { type: "WITHDRAWAL" },
      select: { id: true, amount: true, transactionDate: true, description: true },
      orderBy: { transactionDate: "asc" }
    }),
    db.expense.findMany({
      where: { status: "POSTED" },
      select: { id: true, amount: true, date: true, description: true, category: true },
      orderBy: { date: "asc" }
    }),
    db.season.findMany({ orderBy: { startDate: "desc" } }),
    db.budget.findMany({ where: { status: "ACTIVE" }, include: { season: true, team: true } })
  ]);

  const expenseIds = expenses.map((e) => e.id);
  const generatedDocs = expenseIds.length > 0
    ? await db.generatedDocument.findMany({
        where: { relatedEntityType: "Expense", relatedEntityId: { in: expenseIds } },
        include: { templateVersion: true },
        orderBy: { createdAt: "desc" }
      })
    : [];

  const generatedByExpense = new Map<string, typeof generatedDocs[0]>();
  for (const doc of generatedDocs) {
    if (doc.relatedEntityId && !generatedByExpense.has(doc.relatedEntityId)) {
      generatedByExpense.set(doc.relatedEntityId, doc);
    }
  }

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

  const expenseItems: ClubExpenseItem[] = expenses
    .map((e) => {
      const dt = getOpDateTime(e.date, e.createdAt);
      const genDoc = generatedByExpense.get(e.id);
      const notes = e.notes || "";
      const isExplicitDebt = notes.includes("[DEBT]");
      const isExplicitSettled = notes.includes("[SETTLED]");
      const isSettled = isExplicitSettled || !!e.treasuryTransaction;
      const isDebt = isExplicitDebt || (!isSettled && e.status === "POSTED");
      return {
        id: e.id,
        referenceNumber: e.referenceNumber,
        amount: e.amount,
        date: dt.iso,
        timestamp: dt.timestamp,
        description: e.description,
        category: e.category,
        payeeName: e.payeeName,
        teamName: e.team?.name || null,
        documentId: e.document?.id || e.documentId || null,
        documentName: e.document?.originalName || e.document?.name || null,
        generatedDocId: genDoc?.id || null,
        isDebt,
        isSettled
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  const currencySuffix = locale === "ar" ? " د.ج" : " DZD";
  const currentSeason = seasons.find((s) => s.isCurrent) || seasons[0];
  const clubBudget = budgets.find((b) => !b.teamId) || budgets[0];
  const isExpenseOpen = sp.showNew === "expense" || sp.showNew === "1";
  const today = new Date().toISOString().slice(0, 10);
  const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

  async function handleRecordExpense(formData: FormData) {
    "use server";
    formData.set("autoPost", "true");
    const result = await runFinanceAction(() => createExpenseAction(formData));
    redirect(
      withNotice(
        `/${locale}/dashboard/finance/expenses`,
        result.ok ? "finance.success.expenseRecorded" : result.notice
      )
    );
  }

  return (
    <div className="space-y-6">
      <NoticeToast notice={sp.notice} />
      <FinanceNavTabs locale={locale} />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {locale === "ar" ? "سجل مصروفات النادي" : t("expenses")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {locale === "ar"
              ? "سجل مصاريف النادي، الفواتير، وحالات الدفع"
              : "Gestion et suivi des dépenses, factures et règlements"}
          </p>
        </div>
        {canManage && (
          <Link
            href={
              isExpenseOpen
                ? `/${locale}/dashboard/finance/expenses`
                : `/${locale}/dashboard/finance/expenses?showNew=expense`
            }
          >
            <Button size="sm" className={`${FINANCE_COLORS.expenses.btn} shadow-xs font-semibold`}>
              <Receipt className="me-1.5 h-4 w-4" />
              <span>{locale === "ar" ? "+ تسجيل صرف" : t("addExpense")}</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Inline New Expense Form (Matching Concept of Treasury Deposit & Withdrawal) */}
      {isExpenseOpen && canManage && (
        <form
          action={handleRecordExpense}
          className={`rounded-xl border ${FINANCE_COLORS.expenses.border} ${FINANCE_COLORS.expenses.bg} p-5 shadow-sm space-y-4`}
        >
          <div className={`flex items-center justify-between border-b ${FINANCE_COLORS.expenses.border} pb-3`}>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Receipt className={`h-4 w-4 ${FINANCE_COLORS.expenses.text}`} />
              <span>
                {locale === "ar"
                  ? "تسجيل صرف جديد (مصاريف الإطعام، التنقل، والعتاد)"
                  : t("addExpense")}
              </span>
            </h2>
            <Link
              href={`/${locale}/dashboard/finance/expenses`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {tCommon("cancel")}
            </Link>
          </div>

          <input type="hidden" name="seasonId" value={currentSeason?.id ?? ""} />
          {clubBudget && <input type="hidden" name="budgetId" value={clubBudget.id} />}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "المبلغ المصروف المحدد (د.ج)" : t("fields.amount")} *
              </label>
              <input
                name="amount"
                type="number"
                min={1}
                step={1}
                required
                placeholder="25000"
                className={inputClass}
              />
            </div>

            <div>
              <DateInput
                label={t("fields.date")}
                name="date"
                required
                defaultValue={new Date()}
                locale={locale}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "تصنيف المصروف" : t("fields.category")} *
              </label>
              <select name="category" required defaultValue="FOOD" className={`${inputClass} finance-select`}>
                <option value="FOOD">{locale === "ar" ? "إطعام ووجبات غذائية" : "Restauration"}</option>
                <option value="TRANSPORT">{locale === "ar" ? "نقل ورحلات وتنقلات" : "Transport"}</option>
                <option value="EQUIPMENT">{locale === "ar" ? "عتاد وتجهيزات وألبسة" : "Équipements"}</option>
                <option value="LODGING">{locale === "ar" ? "إيواء وفندقة" : "Hébergement"}</option>
                <option value="MEDICAL">{locale === "ar" ? "مصاريف طبية وعلاج" : "Médical"}</option>
                <option value="ADMINISTRATION">{locale === "ar" ? "مصاريف إدارية وقانونية" : "Administration"}</option>
                <option value="TRAINING">{locale === "ar" ? "تدريبات وتربصات" : "Entraînement"}</option>
                <option value="MATCH">{locale === "ar" ? "مصاريف المباريات الرسمية" : "Matchs"}</option>
                <option value="OTHER">{locale === "ar" ? "مصاريف أخرى" : "Autres"}</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "بيان الصرف وموضوع النفقة" : t("fields.description")} *
              </label>
              <input
                name="description"
                maxLength={500}
                required
                placeholder={
                  locale === "ar"
                    ? "مثال: فاتورة مطعم لوفد الأكابر، شراء كرات تدريب، تكاليف حافلة التنقل..."
                    : "Ex: Facture restauration, achat ballons, transport déplacement..."
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "الجهة المستفيدة / المورد" : t("fields.payeeName")}
              </label>
              <input
                name="payeeName"
                maxLength={160}
                placeholder={locale === "ar" ? "اسم المطعم أو شركة النقل أو المورد" : "Nom du fournisseur"}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "طريقة الدفع" : t("fields.paymentMethod")}
              </label>
              <select name="paymentMethod" defaultValue="CASH" className={`${inputClass} finance-select`}>
                <option value="CASH">{locale === "ar" ? "نقد من الصندوق (كاش)" : "Espèces (Caisse)"}</option>
                <option value="BANK_TRANSFER">{locale === "ar" ? "تحويل بنكي رسمي" : "Virement bancaire"}</option>
                <option value="CARD">{locale === "ar" ? "صك بنكي / بطاقة" : "Chèque / Carte"}</option>
                <option value="OTHER">{locale === "ar" ? "وسيلة دفع أخرى" : "Autre"}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "الفئة الرياضية المعنية" : tTeams("title")}
              </label>
              <select name="teamId" defaultValue="" className={`${inputClass} finance-select`}>
                <option value="">{locale === "ar" ? "على مستوى النادي (عام)" : t("clubWide")}</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tTeams(`categories.${tm.category}` as any)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "حالة الفاتورة والمديونية" : "Statut de paiement / Dette"}
              </label>
              <select name="isDebt" defaultValue="false" className={`${inputClass} finance-select`}>
                <option value="false">{locale === "ar" ? "مسددة (مدفوعة ومسواة نقداً)" : "Payée / Réglée"}</option>
                <option value="true">{locale === "ar" ? "دين معلق على النادي (غير مسدد)" : "Dette en attente (Non réglée)"}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "الفاتورة المختومة أو وصل الصرف" : "Facture visée / Reçu"}
              </label>
              <input
                type="file"
                name="receiptFile"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="w-full text-xs text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer"
              />
            </div>
          </div>

          <div className={`mt-3 flex justify-end gap-2 pt-2 border-t ${FINANCE_COLORS.expenses.border}`}>
            <Link href={`/${locale}/dashboard/finance/expenses`}>
              <Button type="button" variant="outline" size="sm">
                {tCommon("cancel")}
              </Button>
            </Link>
            <Button type="submit" size="sm" className={`${FINANCE_COLORS.expenses.btn} font-medium`}>
              <CheckCircle2 className="me-1.5 h-4 w-4" />
              <span>{locale === "ar" ? "تأكيد تسجيل الصرف" : tCommon("save")}</span>
            </Button>
          </div>
        </form>
      )}

      {/* Chart & KPI: Withdrawals vs Expenses vs Remaining */}
      <ExpenseVsWithdrawalsChart
        withdrawals={withdrawals}
        expenses={allExpensesForChart}
        locale={locale}
      />

      {/* Club Expenses Register Table (Matching FinancialOperationsTable UX, OfficialVoucherModal preview, prominent amount, no status column) */}
      <ClubExpensesTable expenses={expenseItems} locale={locale} />
    </div>
  );
}
