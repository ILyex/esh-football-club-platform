import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { nanoid } from "nanoid";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getAccountBalance } from "@/lib/finance/treasury-service";
import { FINANCE_COLORS } from "@/lib/finance/colors";
import { runFinanceAction, withNotice } from "@/lib/finance/action-notice";
import { createDepositAction, createWithdrawalAction, reverseTransactionAction } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { NoticeToast } from "@/components/shared/notice-toast";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";
import { DateInput } from "@/components/ui/date-input";
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import { parseDMYToISO } from "@/lib/date-utils";
import { Paperclip, ArrowDownLeft, ArrowUpRight } from "lucide-react";

const PAGE_SIZE = 25;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

type SearchParams = {
  notice?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: string;
  action?: string;
};

export default async function TreasuryAccountDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("finance.view", locale);
  const t = await getTranslations("finance");
  const tCommon = await getTranslations("common");
  const canApprove = hasPermission(user, "finance.approve");
  const isProgrammer =
    user.permissions.includes("*") ||
    user.roleKey === "super_admin" ||
    user.roleKey === "developer" ||
    user.email === "admin@esh.dz" ||
    user.email.includes("dev");
  const canRecordTreasury = canApprove || isProgrammer;

  const account = await db.treasuryAccount.findUnique({ where: { id } });
  if (!account) notFound();
  const accountColors = account.type === "BANK"
    ? FINANCE_COLORS.bank
    : account.type === "CASH"
      ? FINANCE_COLORS.cash
      : null;

  const currentAction = sp.action === "withdrawal" || sp.action === "deposit" ? sp.action : null;

  // Filters are validated, never trusted: anything unrecognised is ignored.
  const type = sp.type === "DEPOSIT" || sp.type === "WITHDRAWAL" ? sp.type : undefined;
  const fromIso = parseDMYToISO(sp.from);
  const toIso = parseDMYToISO(sp.to);
  const from = fromIso && DATE_PATTERN.test(fromIso) ? fromIso : undefined;
  const to = toIso && DATE_PATTERN.test(toIso) ? toIso : undefined;
  const requestedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const where: Prisma.TreasuryTransactionWhereInput = {
    treasuryAccountId: id,
    ...(type ? { type } : {}),
    ...(from || to
      ? {
          transactionDate: {
            ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {})
          }
        }
      : {})
  };

  const [balance, total, rows] = await Promise.all([
    getAccountBalance(id), // authoritative: derived from the ledger by treasury-service.ts
    db.treasuryTransaction.count({ where }),
    db.treasuryTransaction.findMany({
      where,
      // Insertion order is the true ledger order (transactionDate can be back-dated), so newest-posted first.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        relatedExpense: { select: { id: true, referenceNumber: true } },
        reversalOfTransaction: { select: { id: true, referenceNumber: true } },
        reversedBy: { select: { id: true, referenceNumber: true } },
        document: true
      }
    })
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = `/${locale}/dashboard/finance/treasury/${id}`;
  const queryFor = (targetPage: number) => {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (targetPage > 1) q.set("page", String(targetPage));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  async function deposit(formData: FormData) {
    "use server";
    // A deposit is never the settlement of an expense: drop any injected link.
    formData.delete("relatedExpenseId");
    formData.set("treasuryAccountId", id);
    const result = await runFinanceAction(() => createDepositAction(formData));
    redirect(withNotice(base, result.ok ? "finance.success.depositRecorded" : result.notice));
  }
  async function withdraw(formData: FormData) {
    "use server";
    // Expense-linked payments are recorded from the expense page; a withdrawal
    // made here is a standalone ledger movement.
    formData.delete("relatedExpenseId");
    formData.set("treasuryAccountId", id);
    const result = await runFinanceAction(() => createWithdrawalAction(formData));
    redirect(withNotice(base, result.ok ? "finance.success.withdrawalRecorded" : result.notice));
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <NoticeToast notice={sp.notice} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{account.name}</h1>
          <Badge tone="neutral" className={accountColors?.badge}>{t(`accountTypes.${account.type}` as any)}</Badge>
          <Badge tone={account.active ? "success" : "neutral"}>{account.active ? t("accountActive") : t("accountInactive")}</Badge>
        </div>
        <Link href={`/${locale}/dashboard/finance/treasury`} className="text-sm text-club-primary underline">
          {tCommon("back")}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 text-center text-sm">
        <div>
          <p className={`text-2xl font-semibold ${balance < 0 ? FINANCE_COLORS.expenses.text : accountColors?.text ?? "text-foreground"}`}>{balance.toLocaleString(locale)}</p>
          <p className="text-xs text-muted-foreground">{t("balance")}</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{account.openingBalance.toLocaleString(locale)}</p>
          <p className="text-xs text-muted-foreground">{t("openingBalance")}</p>
        </div>
        <p className="col-span-2 text-xs text-muted-foreground">{t("ledgerNote")}</p>
      </div>

      {canRecordTreasury && account.active && (
        <div className="space-y-4">
          {/* Action Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {locale === "ar" ? "تسجيل حركة في هذا الحساب:" : "Enregistrer une opération:"}
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={currentAction === "deposit" ? base : `${base}?action=deposit`}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    currentAction === "deposit"
                      ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                  }`}
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "+ تسجيل إيداع" : "+ Enregistrer un dépôt"}</span>
                </Link>

                <Link
                  href={currentAction === "withdrawal" ? base : `${base}?action=withdrawal`}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    currentAction === "withdrawal"
                      ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-500/30"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                  }`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "- تسجيل سحب" : "- Enregistrer un retrait"}</span>
                </Link>
              </div>
            </div>

            {currentAction && (
              <Link
                href={base}
                className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/50"
              >
                <span>{locale === "ar" ? "إخفاء النموذج ✕" : "Fermer ✕"}</span>
              </Link>
            )}
          </div>

          {/* Render ONLY Deposit Form if currentAction === "deposit" */}
          {currentAction === "deposit" && (
            <form
              action={deposit}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.02] p-5 shadow-sm space-y-4 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <ArrowDownLeft className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      {locale === "ar" ? "تسجيل إيداع جديد" : t("newDeposit")}
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      {locale === "ar"
                        ? "دعم الدولة، إعانات البلدية، تمويل الرعاة، أو اشتراكات النادي الرسمية"
                        : "Subventions d'État, aide municipale, sponsors ou cotisations"}
                    </p>
                  </div>
                </div>
                <Link href={base} className="text-xs text-muted-foreground hover:text-foreground">
                  {tCommon("cancel")}
                </Link>
              </div>

              <input type="hidden" name="idempotencyKey" value={nanoid()} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    {t("fields.amount")} ({locale === "ar" ? "دج" : "DZD"}) *
                  </label>
                  <input
                    name="amount"
                    type="number"
                    min={1}
                    step={1}
                    required
                    placeholder="مثال: 50000"
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
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    {locale === "ar" ? "بيان ومصدر الإيداع" : t("fields.description")} *
                  </label>
                  <input
                    name="description"
                    maxLength={500}
                    required
                    placeholder={
                      locale === "ar"
                        ? "مثال: إعانة مديرية الشباب والرياضة DJS، دعم البلدية للموسم الرياضي..."
                        : "Ex: Subvention DJS, soutien municipal..."
                    }
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <FileUploadDropzone
                    name="receiptFile"
                    label={locale === "ar" ? "وصل الإيداع البنكي أو وثيقة الدعم المختومة (PDF / صورة)" : "Bordereau de versement / Justificatif cacheté"}
                    hint={
                      locale === "ar"
                        ? "إرفاق إثبات التمويل (إعانة البلدية، صندوق دعم الدولة للجمعيات، كشف الحساب البنكي، أو صك الإيداع)"
                        : "Joindre l'attestation de subvention, le bordereau de dépôt bancaire ou le chèque."
                    }
                    theme="emerald"
                    locale={locale}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-500/20">
                <Link href={base}>
                  <Button type="button" variant="outline" size="sm">
                    {tCommon("cancel")}
                  </Button>
                </Link>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  <ArrowDownLeft className="me-1.5 h-4 w-4" />
                  <span>{locale === "ar" ? "تأكيد تسجيل الإيداع" : t("deposit")}</span>
                </Button>
              </div>
            </form>
          )}

          {/* Render ONLY Withdrawal Form if currentAction === "withdrawal" */}
          {currentAction === "withdrawal" && (
            <form
              action={withdraw}
              className="rounded-xl border border-amber-500/30 bg-amber-500/[0.02] p-5 shadow-sm space-y-4 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                    <ArrowUpRight className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      {locale === "ar" ? "تسجيل سحب نقدي رسمي من الخزينة" : t("newWithdrawal")}
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      {locale === "ar"
                        ? "سحب سيولة من الحساب البنكي لصندوق النادي لصرف المستحقات والتنقلات والمصاريف الميدانية"
                        : "Alimentation de la caisse pour les dépenses de déplacement, hébergement, etc."}
                    </p>
                  </div>
                </div>
                <Link href={base} className="text-xs text-muted-foreground hover:text-foreground">
                  {tCommon("cancel")}
                </Link>
              </div>

              <input type="hidden" name="idempotencyKey" value={nanoid()} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    {t("fields.amount")} ({locale === "ar" ? "دج" : "DZD"}) *
                  </label>
                  <input
                    name="amount"
                    type="number"
                    min={1}
                    step={1}
                    required
                    placeholder="مثال: 30000"
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
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    {locale === "ar" ? "بيان السحب واسم المستلم / المسؤول" : t("fields.description")} *
                  </label>
                  <input
                    name="description"
                    maxLength={500}
                    required
                    placeholder={
                      locale === "ar"
                        ? "مثال: سحب نقدي من البنك لتغطية تكاليف تنقل الفريق إلى الملعب / إطعام..."
                        : "Ex: Retrait bancaire pour couvrir les frais de déplacement..."
                    }
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <FileUploadDropzone
                    name="receiptFile"
                    label={locale === "ar" ? "وصل السحب البنكي أو إشعار الخصم المعتمد (PDF / صورة)" : "Bordereau de retrait ou reçu signé"}
                    hint={
                      locale === "ar"
                        ? "إرفاق وصل السحب أو الصك أو الإشعار البنكي الرسمي لإثبات خروج المبلغ من الحساب"
                        : "Joindre le bordereau bancaire officiel ou le reçu de retrait de la caisse."
                    }
                    theme="amber"
                    locale={locale}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/60">
                {t("withdrawalExpenseHint")}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-500/20">
                <Link href={base}>
                  <Button type="button" variant="outline" size="sm">
                    {tCommon("cancel")}
                  </Button>
                </Link>
                <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                  <ArrowUpRight className="me-1.5 h-4 w-4" />
                  <span>{locale === "ar" ? "سحب" : (locale === "fr" ? "Retirer" : t("withdrawal"))}</span>
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
      {canRecordTreasury && !account.active && <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">{t("accountInactiveNote")}</p>}

      {/* ------------------------------------------------------------------ Operations */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">{t("operationHistory")}</h2>

        <form className="dashboard-filter-toolbar mb-3">
          <MasterFilterSelect
            name="type"
            locale={locale === "ar" ? "ar" : "fr"}
            label={t("fields.transactionType")}
            value={type ?? ""}
            options={[
              { id: "", label: t("allTypes") },
              { id: "DEPOSIT", label: t("transactionTypes.DEPOSIT") },
              { id: "WITHDRAWAL", label: t("transactionTypes.WITHDRAWAL") }
            ]}
            headerTitle={locale === "ar" ? "تصفية حسب نوع العملية" : "Filtrer par type d’opération"}
          />
          <div>
            <DateInput
              label={t("dateFrom")}
              name="from"
              defaultValue={from}
              locale={locale}
            />
          </div>
          <div>
            <DateInput
              label={t("dateTo")}
              name="to"
              defaultValue={to}
              locale={locale}
            />
          </div>
          <Button type="submit" variant="outline">
            {tCommon("filter")}
          </Button>
        </form>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-start">{t("fields.reference")}</th>
                <th className="px-3 py-2 text-start">{t("fields.transactionType")}</th>
                <th className="px-3 py-2 text-start">{t("fields.amount")}</th>
                <th className="px-3 py-2 text-start">{t("fields.date")}</th>
                <th className="px-3 py-2 text-start">{t("fields.description")}</th>
                <th className="px-3 py-2 text-start">{t("fields.balanceBefore")}</th>
                <th className="px-3 py-2 text-start">{t("fields.balanceAfter")}</th>
                <th className="px-3 py-2 text-start">{t("fields.relatedExpense")}</th>
                <th className="px-3 py-2 text-start">{t("fields.reversal")}</th>
                <th className="px-3 py-2 text-start">{t("supportingDocument")}</th>
                <th className="px-3 py-2 text-start">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const canReverse = canApprove && !row.reversalOfTransactionId && !row.reversedBy;
                async function reverse() {
                  "use server";
                  const result = await runFinanceAction(() => reverseTransactionAction(row.id, id));
                  redirect(withNotice(base, result.ok ? "finance.success.transactionReversed" : result.notice));
                }
                return (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`${base}/transactions/${row.id}`} className="text-club-primary underline">
                        {row.referenceNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={row.type === "DEPOSIT" ? "success" : "warning"}>{t(`transactionTypes.${row.type}` as any)}</Badge>
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {row.type === "DEPOSIT" ? "+" : "−"} {row.amount.toLocaleString(locale)}
                    </td>
                    <td className="px-3 py-2">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(row.transactionDate)}</td>
                    <td className="px-3 py-2">{row.description || "—"}</td>
                    <td className="px-3 py-2">{row.balanceBefore.toLocaleString(locale)}</td>
                    <td className="px-3 py-2">{row.balanceAfter.toLocaleString(locale)}</td>
                    <td className="px-3 py-2">
                      {row.relatedExpense ? (
                        <Link href={`/${locale}/dashboard/finance/expenses/${row.relatedExpense.id}`} className="font-mono text-xs text-club-primary underline">
                          {row.relatedExpense.referenceNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.reversalOfTransaction && (
                        <span>
                          {t("reversalOf")}{" "}
                          <Link href={`${base}/transactions/${row.reversalOfTransaction.id}`} className="font-mono text-club-primary underline">
                            {row.reversalOfTransaction.referenceNumber}
                          </Link>
                        </span>
                      )}
                      {row.reversedBy && (
                        <span>
                          {t("reversedBy")}{" "}
                          <Link href={`${base}/transactions/${row.reversedBy.id}`} className="font-mono text-club-primary underline">
                            {row.reversedBy.referenceNumber}
                          </Link>
                        </span>
                      )}
                      {!row.reversalOfTransaction && !row.reversedBy && "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.document ? (
                        <a
                          href={`/api/documents/${row.document.id}/download`}
                          title={row.document.name}
                          className="inline-flex items-center gap-1.5 font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                        >
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="max-w-[110px] truncate">{row.document.name}</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canReverse && (
                        <ConfirmDialog onConfirm={reverse} title={t("confirmReverseTitle")} body={t("confirmReverseBody")}>
                          <Button type="button" size="sm" variant="outline">
                            {t("reverse")}
                          </Button>
                        </ConfirmDialog>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                    {tCommon("noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link href={queryFor(page - 1)} className="text-club-primary underline">
                {t("previousPage")}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">{t("pageOf", { page, pages: pageCount })}</span>
            {page < pageCount ? (
              <Link href={queryFor(page + 1)} className="text-club-primary underline">
                {t("nextPage")}
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
