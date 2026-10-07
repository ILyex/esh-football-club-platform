import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getAccountBalances } from "@/lib/finance/treasury-service";
import { runFinanceAction, withNotice } from "@/lib/finance/action-notice";
import { createDepositAction, createWithdrawalAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NoticeToast } from "@/components/shared/notice-toast";
import { FinanceNavTabs } from "@/components/finance/finance-nav-tabs";
import { OfficialVoucherModal } from "@/components/finance/official-voucher-modal";
import { EditOpeningBalanceModal } from "@/components/finance/edit-opening-balance-modal";
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import { DateInput } from "@/components/ui/date-input";
import { StyledSelect } from "@/components/ui/styled-select";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  FileText,
  Download,
  Filter,
  Wallet,
  Landmark,
  CheckCircle2,
  Paperclip,
  ShieldCheck
} from "lucide-react";

type SearchParams = {
  notice?: string;
  view?: "BANK" | "CASH" | "DEPOSITS" | "WITHDRAWALS" | "ALL";
  account?: string;
  showNew?: string;
};

export default async function TreasuryDepositsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("finance.view", locale);
  const t = await getTranslations("finance");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "finance.manage");
  const canApprove = hasPermission(user, "finance.approve");
  const canGenerate = canApprove && hasPermission(user, "documents.generate");
  const isProgrammer =
    user.permissions.includes("*") ||
    user.roleKey === "super_admin" ||
    user.email === "admin@esh.dz" ||
    user.email.includes("dev") ||
    user.roleKey === "developer";
  const canRecordTreasury = canApprove || isProgrammer;

  const currentView = sp.view || "ALL";

  const accounts = await db.treasuryAccount.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }]
  });
  const activeAccounts = accounts.filter((a) => a.active);
  const balances = await getAccountBalances(accounts.map((a) => a.id));

  let totalBalance = 0;
  for (const acc of activeAccounts) {
    totalBalance += balances.get(acc.id) ?? 0;
  }

  const primaryBank = activeAccounts.find((a) => a.type === "BANK") || activeAccounts[0];
  const primaryCash = activeAccounts.find((a) => a.type === "CASH");

  // Determine account filter from view or param
  let targetAccountId = sp.account && sp.account !== "ALL" ? sp.account : undefined;
  if (!targetAccountId) {
    if (currentView === "BANK" && primaryBank) targetAccountId = primaryBank.id;
    if (currentView === "CASH" && primaryCash) targetAccountId = primaryCash.id;
  }

  const txWhere = {
    ...(targetAccountId ? { treasuryAccountId: targetAccountId } : {}),
    ...(currentView === "WITHDRAWALS"
      ? { type: "WITHDRAWAL" as const }
      : currentView === "DEPOSITS"
        ? { type: "DEPOSIT" as const }
        : {})
  };

  const [transactions, depositsAgg, withdrawalsAgg] = await Promise.all([
    db.treasuryTransaction.findMany({
      where: txWhere,
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 50,
      include: {
        treasuryAccount: true,
        document: { select: { id: true, name: true, originalName: true } },
        relatedExpense: { select: { id: true, referenceNumber: true } },
        reversalOfTransaction: { select: { id: true, referenceNumber: true } },
        reversedBy: { select: { id: true, referenceNumber: true } }
      }
    }),
    db.treasuryTransaction.aggregate({
      where: { type: "DEPOSIT" },
      _sum: { amount: true },
      _count: { id: true }
    }),
    db.treasuryTransaction.aggregate({
      where: { type: "WITHDRAWAL" },
      _sum: { amount: true },
      _count: { id: true }
    })
  ]);

  const txIds = transactions.map((t) => t.id);
  const generatedDocs = txIds.length > 0
    ? await db.generatedDocument.findMany({
        where: { relatedEntityType: "TreasuryTransaction", relatedEntityId: { in: txIds } },
        include: { templateVersion: true },
        orderBy: { createdAt: "desc" }
      })
    : [];

  const docsByTx = new Map<string, typeof generatedDocs[0]>();
  for (const doc of generatedDocs) {
    if (doc.relatedEntityId && !docsByTx.has(doc.relatedEntityId)) {
      docsByTx.set(doc.relatedEntityId, doc);
    }
  }

  const currencySuffix = locale === "ar" ? " دج" : " DZD";
  const formatMoney = (val: number) => val.toLocaleString(locale) + currencySuffix;
  const today = new Date().toISOString().slice(0, 10);
  const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

  async function handleRecordDeposit(formData: FormData) {
    "use server";
    formData.delete("relatedExpenseId");
    const result = await runFinanceAction(() => createDepositAction(formData));
    redirect(
      withNotice(
        `/${locale}/dashboard/finance/treasury?view=DEPOSITS`,
        result.ok ? "finance.success.depositRecorded" : result.notice
      )
    );
  }

  async function handleRecordWithdrawal(formData: FormData) {
    "use server";
    formData.delete("relatedExpenseId");
    const result = await runFinanceAction(() => createWithdrawalAction(formData));
    redirect(
      withNotice(
        `/${locale}/dashboard/finance/treasury?view=WITHDRAWALS`,
        result.ok ? "finance.success.withdrawalRecorded" : result.notice
      )
    );
  }

  const isDepositOpen = sp.showNew === "deposit" || sp.showNew === "1";
  const isWithdrawalOpen = sp.showNew === "withdrawal";
  const showDepositAction = currentView !== "WITHDRAWALS";
  const showWithdrawalAction = currentView !== "DEPOSITS";
  const treasuryViewHref = (showNew?: "deposit" | "withdrawal") => {
    const query = new URLSearchParams();
    if (currentView !== "ALL") query.set("view", currentView);
    if (showNew) query.set("showNew", showNew);
    const search = query.toString();
    return `/${locale}/dashboard/finance/treasury${search ? `?${search}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <NoticeToast notice={sp.notice} />
      <FinanceNavTabs locale={locale} />

      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {locale === "ar" ? "حركة الخزينة" : "Trésorerie"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(canApprove || isProgrammer) && (
            <>
              {showDepositAction && (
              <Link
                href={treasuryViewHref(isDepositOpen ? undefined : "deposit")}
                className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
              >
                <ArrowDownLeft className="me-1.5 h-4 w-4" />
                <span>{locale === "ar" ? "+ تسجيل إيداع" : t("newDepositTitle")}</span>
              </Link>
              )}
              {showWithdrawalAction && (
              <Link
                href={treasuryViewHref(isWithdrawalOpen ? undefined : "withdrawal")}
                className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-amber-300 bg-transparent px-3 text-xs font-semibold text-amber-600 shadow-xs transition-colors hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/20"
              >
                <ArrowUpRight className="me-1.5 h-4 w-4" />
                <span>{locale === "ar" ? "- تسجيل سحب" : "Nouveau Retrait"}</span>
              </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* KPI Summary Cards - Synchronized with Selected View */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Bank Balance */}
        <div className={`flex flex-col justify-between rounded-xl border p-4 shadow-xs ${
          currentView === "BANK" ? "border-blue-500/40 bg-blue-500/5 ring-1 ring-blue-500/30" : "border-border/80 bg-card"
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                {locale === "ar" ? "1. الحساب البنكي (BNA)" : "1. Compte Bancaire (BNA)"}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
              {formatMoney(primaryBank ? (balances.get(primaryBank.id) ?? primaryBank.openingBalance) : 0)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground truncate" title={primaryBank?.name}>
              {primaryBank?.name || (locale === "ar" ? "رصيد البنك الرسمي" : "Solde BNA")}
            </p>
          </div>
          {isProgrammer && primaryBank && (
            <div className="mt-3 pt-2 border-t border-border/60">
              <EditOpeningBalanceModal
                accountId={primaryBank.id}
                accountName={primaryBank.name}
                currentBalance={primaryBank.openingBalance}
                locale={locale}
              />
            </div>
          )}
        </div>

        {/* Card 2: Cash / Caisse Balance */}
        <div className={`flex flex-col justify-between rounded-xl border p-4 shadow-xs ${
          currentView === "CASH" ? "border-teal-500/40 bg-teal-500/5 ring-1 ring-teal-500/30" : "border-border/80 bg-card"
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                {locale === "ar" ? "2. الصندوق (السيولة النقدية)" : "2. Caisse (Espèces)"}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-teal-600 dark:text-teal-400">
              {formatMoney(primaryCash ? (balances.get(primaryCash.id) ?? 0) : 0)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {locale === "ar" ? "السيولة الحالية المتاحة للصرف المباشر" : "Espèces disponibles"}
            </p>
          </div>
        </div>

        {/* Card 3: Total Deposits (Inflows) */}
        <div className={`flex flex-col justify-between rounded-xl border p-4 shadow-xs ${
          currentView === "DEPOSITS" ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-border/80 bg-card"
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                {locale === "ar" ? "3. إجمالي الإيداعات" : "3. Total des Dépôts"}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              +{formatMoney(depositsAgg._sum.amount ?? 0)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {depositsAgg._count.id} {locale === "ar" ? "عملية إيداع بوصل رسمي" : "dépôts enregistrés"}
            </p>
          </div>
        </div>

        {/* Card 4: Total Withdrawals */}
        <div className={`flex flex-col justify-between rounded-xl border p-4 shadow-xs ${
          currentView === "WITHDRAWALS" ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/30" : "border-border/80 bg-card"
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                {locale === "ar" ? "4. إجمالي السحوبات (السيولة)" : "4. Total des Retraits"}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              -{formatMoney(withdrawalsAgg._sum.amount ?? 0)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {withdrawalsAgg._count.id} {locale === "ar" ? "عملية سحب رسمي معتمدة" : "retraits autorisés"}
            </p>
          </div>
        </div>
      </div>

      {/* Inline New Deposit Form (Auto-defaults to official bank account) */}
      {isDepositOpen && canRecordTreasury && activeAccounts.length > 0 && (
        <form
          action={handleRecordDeposit}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
              <span>{locale === "ar" ? "تسجيل إيداع جديد (دعم الدولة / صندوق الدعم / محبي النادي)" : t("newDepositTitle")}</span>
            </h2>
            <Link
              href={`/${locale}/dashboard/finance/treasury`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {tCommon("cancel")}
            </Link>
          </div>
          <input type="hidden" name="idempotencyKey" value={nanoid()} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "الحساب المستلم (الحساب البنكي الرسمي تلقائياً)" : t("account")} *
              </label>
              <StyledSelect
                name="treasuryAccountId"
                defaultValue={primaryBank?.id ?? activeAccounts[0]!.id}
                className="w-full"
                tone="emerald"
                options={activeAccounts.map((a) => ({
                  value: a.id,
                  label: `${a.name} (${t(`accountTypes.${a.type}` as any)}) ${a.id === primaryBank?.id ? (locale === "ar" ? "(البنك الرسمي المعتمد للنادي)" : "(Compte Principal)") : ""}`
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "المبلغ المودع المحدد (دج)" : t("fields.amount")} *
              </label>
              <input
                name="amount"
                type="number"
                min={1}
                step={1}
                required
                placeholder="50000"
                className={inputClass}
              />
            </div>
            <div>
              <DateInput
                label={t("fields.date")}
                name="transactionDate"
                required
                defaultValue={new Date()}
                locale={locale}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "المعني بالعملية (الاسم الكامل)" : "Bénéficiaire / Déposant"}
              </label>
              <input
                name="beneficiaryName"
                maxLength={120}
                placeholder={locale === "ar" ? "اسم الشخص أو الهيئة المودعة" : "Nom complet ou organisme"}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "رقم بطاقة التعريف الوطنية (CNI)" : "N° Carte Nationale d'Identité"}
              </label>
              <input
                name="nationalIdNumber"
                maxLength={30}
                placeholder="10XXXXXXXXXX"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "بيان الإيداع ومصدر الدعم" : t("fields.description")}
              </label>
              <input
                name="description"
                maxLength={500}
                placeholder={
                  locale === "ar"
                    ? "مثال: إعانة البلدية، منحة وزارة الشباب والرياضة، دعم محبي النادي..."
                    : "Ex: Subvention municipale, subvention DJS, soutien supporters..."
                }
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-3">
              <FileUploadDropzone
                name="receiptFile"
                label={locale === "ar" ? "الفاتورة المختومة أو وصل الإيداع البنكي" : "Justificatif / Bordereau visé"}
                hint={
                  locale === "ar"
                    ? "إرفاق إشعار البنك، صك الإيداع، أو وثيقة الدعم المعتمدة (PDF، PNG، JPG - الحد الأقصى 10 ميغابايت)"
                    : "Joindre le bordereau de dépôt bancaire ou l'attestation de subvention (PDF, PNG, JPG max 10 Mo)"
                }
                theme="emerald"
                locale={locale}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2 pt-2 border-t border-emerald-500/20">
            <Link href={`/${locale}/dashboard/finance/treasury`}>
              <Button type="button" variant="outline" size="sm">
                {tCommon("cancel")}
              </Button>
            </Link>
            <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
              <CheckCircle2 className="me-1.5 h-4 w-4" />
              {t("deposit")}
            </Button>
          </div>
        </form>
      )}

      {isDepositOpen && canRecordTreasury && activeAccounts.length === 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-foreground">لا يمكن فتح نموذج الإيداع بعد</h2>
          <p className="mt-1 text-xs text-muted-foreground">يجب إنشاء حساب خزينة نشط أولاً حتى يتم تسجيل الحركة وحفظها في السجل المالي.</p>
          <Link href={`/${locale}/dashboard/finance/treasury/new`} className="mt-4 inline-flex h-8 items-center justify-center rounded-md bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700">
            إنشاء حساب خزينة
          </Link>
        </div>
      )}

      {/* Inline New Withdrawal Form (Auto-defaults to official bank account) */}
      {isWithdrawalOpen && canRecordTreasury && activeAccounts.length > 0 && (
        <form
          action={handleRecordWithdrawal}
          className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-amber-600" />
              <span>{locale === "ar" ? "تسجيل صرف / سحب (مصاريف النقل، الإطعام، العتاد)" : "Nouveau Retrait / Décaissement"}</span>
            </h2>
            <Link
              href={`/${locale}/dashboard/finance/treasury`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {tCommon("cancel")}
            </Link>
          </div>
          <input type="hidden" name="idempotencyKey" value={nanoid()} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "حساب السحب (الحساب البنكي الرسمي تلقائياً)" : t("account")} *
              </label>
              <StyledSelect
                name="treasuryAccountId"
                defaultValue={primaryBank?.id ?? activeAccounts[0]!.id}
                className="w-full"
                tone="amber"
                options={activeAccounts.map((a) => ({
                  value: a.id,
                  label: `${a.name} (${t(`accountTypes.${a.type}` as any)}) ${a.id === primaryBank?.id ? (locale === "ar" ? "(البنك الرسمي المعتمد للنادي)" : "(Compte Principal)") : ""}`
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "المبلغ المسحوب المحدد (دج)" : t("fields.amount")} *
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
                name="transactionDate"
                required
                defaultValue={new Date()}
                locale={locale}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "المعني بالعملية (الاسم الكامل)" : "Bénéficiaire / Retirant"}
              </label>
              <input
                name="beneficiaryName"
                maxLength={120}
                placeholder={locale === "ar" ? "اسم الشخص المستلم أو المسؤول" : "Nom complet du bénéficiaire"}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "رقم بطاقة التعريف الوطنية (CNI)" : "N° Carte Nationale d'Identité"}
              </label>
              <input
                name="nationalIdNumber"
                maxLength={30}
                placeholder="10XXXXXXXXXX"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground">
                {locale === "ar" ? "بيان الصرف ومبرر النفقة" : t("fields.description")}
              </label>
              <input
                name="description"
                maxLength={500}
                placeholder={
                  locale === "ar"
                    ? "مثال: إطعام الفريق الأول، رحلة تيارت، شراء كرات ومعدات تدريب..."
                    : "Ex: Restauration équipe, déplacement match, achat ballons..."
                }
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-3">
              <FileUploadDropzone
                name="receiptFile"
                label={locale === "ar" ? "الفاتورة المختومة من الجهة المستفيدة أو إشعار الخصم" : "Facture acquittée / Justificatif"}
                hint={
                  locale === "ar"
                    ? "إرفاق وصل السحب البنكي، إشعار الخصم، أو الفاتورة المبررة للنفقة (PDF، PNG، JPG - الحد الأقصى 10 ميغابايت)"
                    : "Joindre le bordereau de retrait ou la facture acquittée (PDF, PNG, JPG max 10 Mo)"
                }
                theme="amber"
                locale={locale}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2 pt-2 border-t border-amber-500/20">
            <Link href={`/${locale}/dashboard/finance/treasury`}>
              <Button type="button" variant="outline" size="sm">
                {tCommon("cancel")}
              </Button>
            </Link>
            <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-medium">
              <CheckCircle2 className="me-1.5 h-4 w-4" />
              {locale === "ar" ? "سحب" : "Retirer"}
            </Button>
          </div>
        </form>
      )}

      {isWithdrawalOpen && canRecordTreasury && activeAccounts.length === 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-foreground">لا يمكن فتح نموذج السحب بعد</h2>
          <p className="mt-1 text-xs text-muted-foreground">يجب إنشاء حساب خزينة نشط أولاً حتى يتم تسجيل الحركة وحفظها في السجل المالي.</p>
          <Link href={`/${locale}/dashboard/finance/treasury/new`} className="mt-4 inline-flex h-8 items-center justify-center rounded-md bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700">
            إنشاء حساب خزينة
          </Link>
        </div>
      )}

      {/* Filter and View Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/${locale}/dashboard/finance/treasury?view=ALL`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              currentView === "ALL"
                ? "bg-foreground text-background shadow-xs font-bold"
                : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {locale === "ar" ? "كافة الحركات" : "Toutes les opérations"} ({depositsAgg._count.id + withdrawalsAgg._count.id})
          </Link>
          <Link
            href={`/${locale}/dashboard/finance/treasury?view=BANK`}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              currentView === "BANK"
                ? "bg-blue-600 text-white shadow-xs font-bold"
                : "text-blue-700 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
            }`}
          >
            <Landmark className="h-3 w-3" />
            <span>{locale === "ar" ? "البنك (BNA)" : "Banque (BNA)"}</span>
          </Link>
          <Link
            href={`/${locale}/dashboard/finance/treasury?view=CASH`}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              currentView === "CASH"
                ? "bg-teal-600 text-white shadow-xs font-bold"
                : "text-teal-700 dark:text-teal-400 bg-teal-500/10 hover:bg-teal-500/20"
            }`}
          >
            <Wallet className="h-3 w-3" />
            <span>{locale === "ar" ? "الصندوق" : "Caisse"}</span>
          </Link>
          <Link
            href={`/${locale}/dashboard/finance/treasury?view=DEPOSITS`}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              currentView === "DEPOSITS"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
            }`}
          >
            <ArrowDownLeft className="h-3 w-3" />
            <span>{t("deposits")} ({depositsAgg._count.id})</span>
          </Link>
          <Link
            href={`/${locale}/dashboard/finance/treasury?view=WITHDRAWALS`}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              currentView === "WITHDRAWALS"
                ? "bg-amber-600 text-white shadow-xs font-bold"
                : "text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
            }`}
          >
            <ArrowUpRight className="h-3 w-3" />
            <span>{t("withdrawals")} ({withdrawalsAgg._count.id})</span>
          </Link>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>{locale === "ar" ? "الخزينة المركزية الرسمية للنادي" : "Trésorerie certifiée du club"}</span>
        </div>
      </div>

      {/* Main Operations / Deposits Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-4 py-2.5 text-start">{t("fields.reference")}</th>
              <th className="px-4 py-2.5 text-start">{t("fields.date")}</th>
              <th className="px-4 py-2.5 text-start">{t("fields.description")}</th>
              <th className="px-4 py-2.5 text-start">{locale === "ar" ? "الحساب" : (t("fields.account") || "Account")}</th>
              <th className="px-4 py-2.5 text-start">{t("fields.amount")}</th>
              <th className="px-4 py-2.5 text-start">{t("balanceImpact")}</th>
              <th className="px-4 py-2.5 text-start">{locale === "ar" ? "وصل العملية" : tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const isDeposit = tx.type === "DEPOSIT";
              const isReversed = tx.reversedBy !== null;
              const isReversal = tx.reversalOfTransactionId !== null;

              return (
                <tr
                  key={tx.id}
                  className={`border-b border-border last:border-0 hover:bg-muted/20 ${
                    isReversed ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link
                      href={`/${locale}/dashboard/finance/treasury/${tx.treasuryAccountId}/transactions/${tx.id}`}
                      className="text-club-primary hover:underline font-semibold"
                    >
                      {tx.referenceNumber}
                    </Link>
                    {isReversal && (
                      <span className="ms-1.5 text-[10px] text-muted-foreground">({t("reversalEntry")})</span>
                    )}
                    {isReversed && (
                      <span className="ms-1.5 text-[10px] text-destructive">({t("reversed")})</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
                      tx.transactionDate
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="max-w-xs truncate text-foreground">
                      {tx.description || (isDeposit ? t("deposit") : t("withdrawal"))}
                    </div>
                    {tx.relatedExpense && (
                      <Link
                        href={`/${locale}/dashboard/finance/expenses/${tx.relatedExpense.id}`}
                        className="text-[11px] text-club-primary underline"
                      >
                        {tx.relatedExpense.referenceNumber}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/${locale}/dashboard/finance/treasury/${tx.treasuryAccountId}`}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {tx.treasuryAccount.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono font-semibold">
                    <span
                      className={
                        isDeposit
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }
                    >
                      {isDeposit ? "+" : "−"} {tx.amount.toLocaleString(locale)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {tx.balanceAfter.toLocaleString(locale)}
                  </td>
                  <td className="px-4 py-2.5">
                    <OfficialVoucherModal
                      type={tx.type}
                      referenceNumber={tx.referenceNumber}
                      amount={tx.amount}
                      date={tx.transactionDate}
                      beneficiaryOrSource={tx.description || (isDeposit ? "إعانة / تمويل مالي" : "مصاريف ونشاط النادي")}
                      purpose={tx.description || (isDeposit ? "إيداع في خزينة النادي" : "سحب نقدي من الخزينة")}
                      accountName={tx.treasuryAccount.name}
                      locale={locale}
                      buttonLabel={isDeposit ? (locale === "ar" ? "وصل إيداع" : "Reçu") : (locale === "ar" ? "وصل سحب" : "Bon")}
                      className="h-6 px-2 text-[10px]"
                    />
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {tCommon("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Club Central Official Account Card */}
      {primaryBank && (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-background p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">
                    {primaryBank.name}
                  </h2>
                  <span className="inline-flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-1" title={locale === "ar" ? "حساب رسمي معتمد" : "Compte Officiel"}>
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {locale === "ar"
                    ? "الحساب البنكي الرئيسي"
                    : "Compte bancaire principal"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isProgrammer && (
                <EditOpeningBalanceModal
                  accountId={primaryBank.id}
                  accountName={primaryBank.name}
                  currentBalance={primaryBank.openingBalance}
                  locale={locale}
                />
              )}
              <Link href={`/${locale}/dashboard/finance/treasury/${primaryBank.id}`}>
                <Button variant="outline" size="sm" className="text-xs font-semibold">
                  <span>{locale === "ar" ? "معاينة السجل التفصيلي للحساب ←" : "Grand livre ←"}</span>
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-center">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <span className="text-[11px] text-muted-foreground block font-medium">
                {locale === "ar" ? "الرصيد الافتتاحي (الإعانة)" : "Solde Initial"}
              </span>
              <span className="text-base font-bold font-mono text-foreground mt-1 block">
                {formatMoney(primaryBank.openingBalance)}
              </span>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-medium">
                {locale === "ar" ? "إجمالي الإيداعات" : "Total Dépôts"}
              </span>
              <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                +{formatMoney(depositsAgg._sum.amount ?? 0)}
              </span>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3">
              <span className="text-[11px] text-amber-700 dark:text-amber-400 block font-medium">
                {locale === "ar" ? "إجمالي السحوبات" : "Total Retraits"}
              </span>
              <span className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
                -{formatMoney(withdrawalsAgg._sum.amount ?? 0)}
              </span>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
              <span className="text-[11px] text-primary font-bold block">
                {locale === "ar" ? "الرصيد الصافي المتاح" : "Solde Disponible"}
              </span>
              <span className="text-base font-black font-mono text-primary mt-1 block">
                {formatMoney(totalBalance)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
