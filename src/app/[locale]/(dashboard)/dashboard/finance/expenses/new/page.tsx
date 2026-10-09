import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { createExpenseAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NoticeToast } from "@/components/shared/notice-toast";
import { runFinanceAction, withNotice } from "@/lib/finance/action-notice";
import { FinanceNavTabs } from "@/components/finance/finance-nav-tabs";
import { Receipt, CheckCircle2 } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { FINANCE_COLORS } from "@/lib/finance/colors";
import { StyledSelect } from "@/components/ui/styled-select";

export default async function NewExpensePage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { locale } = await params;
  const { notice } = await searchParams;
  await requirePagePermission("finance.manage", locale);
  const t = await getTranslations("finance");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const [seasons, teams, budgets] = await Promise.all([
    db.season.findMany({ orderBy: { startDate: "desc" } }),
    db.team.findMany({ orderBy: { category: "asc" } }),
    db.budget.findMany({ where: { status: "ACTIVE" }, include: { season: true, team: true } })
  ]);

  const currentSeason = seasons.find((s) => s.isCurrent) || seasons[0];
  const clubBudget = budgets.find((b) => !b.teamId) || budgets[0];
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
      <NoticeToast notice={notice} />
      <FinanceNavTabs locale={locale} />

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
            <StyledSelect name="category" defaultValue="FOOD" tone="default" options={[
              { value: "FOOD", label: locale === "ar" ? "إطعام ووجبات غذائية" : "Restauration" },
              { value: "TRANSPORT", label: locale === "ar" ? "نقل ورحلات وتنقلات" : "Transport" },
              { value: "EQUIPMENT", label: locale === "ar" ? "عتاد وتجهيزات وألبسة" : "Équipements" },
              { value: "LODGING", label: locale === "ar" ? "إيواء وفندقة" : "Hébergement" },
              { value: "MEDICAL", label: locale === "ar" ? "مصاريف طبية وعلاج" : "Médical" },
              { value: "ADMINISTRATION", label: locale === "ar" ? "مصاريف إدارية وقانونية" : "Administration" },
              { value: "TRAINING", label: locale === "ar" ? "تدريبات وتربصات" : "Entraînement" },
              { value: "MATCH", label: locale === "ar" ? "مصاريف المباريات الرسمية" : "Matchs" },
              { value: "OTHER", label: locale === "ar" ? "مصاريف أخرى" : "Autres" }
            ]} />
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
            <StyledSelect name="paymentMethod" defaultValue="CASH" options={[
              { value: "CASH", label: locale === "ar" ? "نقد من الصندوق (كاش)" : "Espèces (Caisse)" },
              { value: "BANK_TRANSFER", label: locale === "ar" ? "تحويل بنكي رسمي" : "Virement bancaire" },
              { value: "CARD", label: locale === "ar" ? "صك بنكي / بطاقة" : "Chèque / Carte" },
              { value: "OTHER", label: locale === "ar" ? "وسيلة دفع أخرى" : "Autre" }
            ]} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {locale === "ar" ? "الفئة الرياضية المعنية" : tTeams("title")}
            </label>
            <StyledSelect name="teamId" defaultValue="" options={[
              { value: "", label: locale === "ar" ? "على مستوى النادي (عام)" : t("clubWide") },
              ...teams.map((tm) => ({ value: tm.id, label: tTeams(`categories.${tm.category}` as any) }))
            ]} />
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
    </div>
  );
}
