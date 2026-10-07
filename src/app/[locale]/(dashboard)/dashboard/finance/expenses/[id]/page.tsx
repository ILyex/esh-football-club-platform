import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { requirePagePermission, requirePermission, hasPermission, requiredPermissionForDocument } from "@/lib/permissions";
import { getAccountBalances } from "@/lib/finance/treasury-service";
import { runFinanceAction, withNotice } from "@/lib/finance/action-notice";
import { updateExpenseAction, postExpenseAction, cancelExpenseAction } from "../actions";
import { createWithdrawalAction } from "../../treasury/actions";
import { attachExpenseDocumentAction } from "@/lib/finance/supporting-documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { NoticeToast } from "@/components/shared/notice-toast";
import { ExpenseFormFields } from "@/components/finance/expense-form-fields";
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal";
import { DateInput } from "@/components/ui/date-input";
import { Save,  FileText, FileCheck, Download, Upload } from "lucide-react";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { DRAFT: "warning", POSTED: "success", CANCELLED: "neutral" };
const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export default async function ExpenseDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { locale, id } = await params;
  const { notice } = await searchParams;
  // Server-side gate for direct URL / direct-ID access. Every mutation below
  // is additionally protected inside its own action.
  const user = await requirePagePermission("finance.view", locale);
  const t = await getTranslations("finance");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const tTemplates = await getTranslations("templates");

  const canManage = hasPermission(user, "finance.manage");
  const canApprove = hasPermission(user, "finance.approve");
  const canGenerate = canApprove && hasPermission(user, "documents.generate");

  const expense = await db.expense.findUnique({
    where: { id },
    include: {
      team: true,
      season: true,
      budget: { include: { season: true, team: true } },
      relatedMatch: true,
      relatedTraining: true,
      document: true,
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      treasuryTransaction: { include: { treasuryAccount: true, reversedBy: { select: { id: true, referenceNumber: true } } } }
    }
  });
  if (!expense) notFound();

  const payment = expense.treasuryTransaction;
  const paymentState = !payment ? "NONE" : payment.reversedBy ? "REVERSED" : "PAID";
  const base = `/${locale}/dashboard/finance/expenses/${id}`;

  const isDraft = expense.status === "DRAFT";
  const isPosted = expense.status === "POSTED";
  const canRecordPayment = canApprove && isPosted && !payment;

  // Data for the two optional panels — only loaded when the panel can be shown.
  const [accounts, editOptions, generatedDocuments, statementVersions] = await Promise.all([
    canRecordPayment ? db.treasuryAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    isDraft && canManage
      ? Promise.all([
          db.season.findMany({ orderBy: { startDate: "desc" } }),
          db.team.findMany({ orderBy: { category: "asc" } }),
          db.budget.findMany({ where: { OR: [{ status: "ACTIVE" }, { id: expense.budgetId ?? "" }] }, include: { season: true, team: true } }),
          db.match.findMany({ orderBy: { matchDate: "desc" }, take: 30 }),
          db.trainingSession.findMany({ orderBy: { date: "desc" }, take: 30 })
        ])
      : Promise.resolve(null),
    canGenerate
      ? db.generatedDocument.findMany({
          where: { relatedEntityType: "Expense", relatedEntityId: id },
          include: { templateVersion: { include: { template: true } } },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([]),
    canGenerate && isPosted
      ? db.documentTemplateVersion.findMany({ where: { status: "ACTIVE", template: { type: "EXPENSE_STATEMENT" } }, include: { template: true }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([])
  ]);
  const balances = await getAccountBalances(accounts.map((a) => a.id));

  // Make sure the currently linked match is offered even if it is older than the 30 most recent.
  let matchOptions = editOptions ? editOptions[3] : [];
  if (editOptions && expense.relatedMatch && !matchOptions.some((m) => m.id === expense.relatedMatch!.id)) {
    matchOptions = [expense.relatedMatch, ...matchOptions];
  }

  // ---- page-local server actions: thin wrappers that translate a rejected
  // domain rule into a localized notice. The actions they call enforce the
  // real permission + lifecycle checks themselves.
  async function update(formData: FormData) {
    "use server";
    const result = await runFinanceAction(() => updateExpenseAction(id, formData));
    redirect(withNotice(base, result.ok ? "finance.success.expenseUpdated" : result.notice));
  }
  async function post() {
    "use server";
    const result = await runFinanceAction(() => postExpenseAction(id));
    redirect(withNotice(base, result.ok ? "finance.success.expensePosted" : result.notice));
  }
  async function cancel() {
    "use server";
    const result = await runFinanceAction(() => cancelExpenseAction(id));
    redirect(withNotice(base, result.ok ? "finance.success.expenseCancelled" : result.notice));
  }
  async function pay(formData: FormData) {
    "use server";
    // relatedExpenseId and amount are re-derived here from the URL id and the
    // database — the form values for them are never trusted (the service
    // additionally re-checks status, uniqueness and amount equality).
    const result = await runFinanceAction(async () => {
      await requirePermission("finance.approve"); // before any read — createWithdrawalAction re-checks it as well
      const current = await db.expense.findUniqueOrThrow({ where: { id } });
      formData.set("relatedExpenseId", id);
      formData.set("amount", String(current.amount));
      return createWithdrawalAction(formData);
    });
    redirect(withNotice(base, result.ok ? "finance.success.paymentRecorded" : result.notice));
  }
  async function attachProof(formData: FormData) {
    "use server";
    const result = await runFinanceAction(() => attachExpenseDocumentAction(id, formData));
    redirect(withNotice(base, result.ok ? "finance.success.documentAttached" : result.notice));
  }

  const documentAllowed = expense.document ? hasPermission(user, requiredPermissionForDocument(expense.document.classification)) : false;
  const dash = "—";

  return (
    <div className="max-w-4xl space-y-6">
      <NoticeToast notice={notice} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-semibold">{expense.referenceNumber}</h1>
          <Badge tone={STATUS_TONE[expense.status]}>{t(`expenseStatuses.${expense.status}` as any)}</Badge>
          {isPosted && <Badge tone={paymentState === "PAID" ? "success" : "neutral"}>{t(`paymentStates.${paymentState}` as any)}</Badge>}
        </div>
        <Link href={`/${locale}/dashboard/finance/expenses`} className="text-sm text-club-primary underline">
          {tCommon("back")}
        </Link>
      </div>

      {/* The two concepts are deliberately kept apart on screen. */}
      <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">{t("expenseVsTreasuryNote")}</p>

      {/* ------------------------------------------------------------ Expense record */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">{t("expenseRecord")}</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.reference")}</dt>
            <dd className="font-mono">{expense.referenceNumber}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.amount")}</dt>
            <dd className="font-semibold">{expense.amount.toLocaleString(locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.category")}</dt>
            <dd>{t(`categories.${expense.category}` as any)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.date")}</dt>
            <dd>{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(expense.date)}</dd>
          </div>
          <div className="col-span-2 md:col-span-2">
            <dt className="text-xs text-muted-foreground">{t("fields.description")}</dt>
            <dd>{expense.description}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.payeeName")}</dt>
            <dd>{expense.payeeName || dash}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.paymentMethod")}</dt>
            <dd>{expense.paymentMethod ? t(`paymentMethods.${expense.paymentMethod}` as any) : dash}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{tTeams("title")}</dt>
            <dd>{expense.team ? tTeams(`categories.${expense.team.category}` as any) : t("clubWide")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.season")}</dt>
            <dd>{expense.season.label}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.budget")}</dt>
            <dd>
              {expense.budget ? (
                <Link href={`/${locale}/dashboard/finance/budgets/${expense.budget.id}`} className="text-club-primary underline">
                  {expense.budget.season.label} — {expense.budget.team ? tTeams(`categories.${expense.budget.team.category}` as any) : t("clubWide")}
                </Link>
              ) : (
                dash
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.relatedMatch")}</dt>
            <dd>
              {expense.relatedMatch ? (
                hasPermission(user, "matches.view") ? (
                  <Link href={`/${locale}/dashboard/matches/${expense.relatedMatch.id}`} className="text-club-primary underline">
                    {expense.relatedMatch.homeTeamName} – {expense.relatedMatch.awayTeamName}
                  </Link>
                ) : (
                  <span>
                    {expense.relatedMatch.homeTeamName} – {expense.relatedMatch.awayTeamName}
                  </span>
                )
              ) : (
                dash
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.relatedTraining")}</dt>
            <dd>
              {expense.relatedTraining ? (
                hasPermission(user, "training.view") ? (
                  <Link href={`/${locale}/dashboard/training/${expense.relatedTraining.id}`} className="text-club-primary underline">
                    {new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(expense.relatedTraining.date)}
                  </Link>
                ) : (
                  <span>{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(expense.relatedTraining.date)}</span>
                )
              ) : (
                dash
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.status")}</dt>
            <dd>{t(`expenseStatuses.${expense.status}` as any)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("supportingDocument")}</dt>
            <dd>
              {expense.document ? (
                documentAllowed ? (
                  <a href={`/api/documents/${expense.document.id}/download`} className="text-club-primary underline">
                    {expense.document.name}
                  </a>
                ) : (
                  <span className="text-muted-foreground">{t("documentRestricted")}</span>
                )
              ) : (
                dash
              )}
            </dd>
          </div>
          <div className="col-span-2 md:col-span-3">
            <dt className="text-xs text-muted-foreground">{t("fields.notes")}</dt>
            <dd className="whitespace-pre-wrap">{expense.notes || dash}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.createdBy")}</dt>
            <dd>
              {expense.createdBy.name} — {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(expense.createdAt)}
            </dd>
          </div>
          {expense.updatedBy && (
            <div>
              <dt className="text-xs text-muted-foreground">{t("fields.updatedBy")}</dt>
              <dd>
                {expense.updatedBy.name} — {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(expense.updatedAt)}
              </dd>
            </div>
          )}
        </dl>

        {/* Lifecycle actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {isDraft && canApprove && (
            <ConfirmDialog onConfirm={post} title={t("confirmPostTitle")} body={t("confirmPostBody")}>
              <Button type="button">{t("post")}</Button>
            </ConfirmDialog>
          )}
          {expense.status !== "CANCELLED" && canApprove && (!payment || payment.reversedBy) && (
            <ConfirmDialog onConfirm={cancel} title={t("confirmCancelTitle")} body={t("confirmCancelBody")}>
              <Button type="button" variant="outline">
                {t("cancelExpense")}
              </Button>
            </ConfirmDialog>
          )}
          {expense.status !== "CANCELLED" && payment && !payment.reversedBy && <p className="text-xs text-muted-foreground">{t("cancelBlockedByPayment")}</p>}
          {isPosted && <p className="text-xs text-muted-foreground">{t("postedLocked")}</p>}
          {expense.status === "CANCELLED" && <p className="text-xs text-muted-foreground">{t("cancelledLocked")}</p>}
        </div>
      </section>

      {/* ------------------------------------------------ Supporting Stamped Invoice / Receipt */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-club-primary" />
            {t("supportingDocument")}
          </h2>
          {expense.document && (
            <Badge tone="success">{locale === "ar" ? "فاتورة مختومة ومعتمدة" : "Facture visée & validée"}</Badge>
          )}
        </div>

        {expense.document ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">{expense.document.name}</p>
                <p className="text-xs text-muted-foreground">
                  {expense.document.originalName} • {(expense.document.sizeBytes >> 10) || 1} KB
                </p>
              </div>
            </div>
            {documentAllowed ? (
              <div className="flex items-center gap-2">
                <DocumentPreviewModal
                  documentId={expense.document.id}
                  title={expense.document.name}
                  fileName={expense.document.originalName}
                  mimeType={expense.document.mimeType}
                  locale={locale}
                  buttonLabel={locale === "ar" ? "معاينة الفاتورة" : "Aperçu"}
                />
                <a
                  href={`/api/documents/${expense.document.id}/download`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md bg-club-primary px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-club-primary/90 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{tCommon("download")}</span>
                </a>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">{t("documentRestricted")}</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {locale === "ar"
              ? "لم يتم إرفاق فاتورة أو إثبات مالي مختوم لهذا المصروف (فاتورة إطعام، وصل نقل ورحلات، فاتورة عتاد ومعدات)."
              : "Aucune facture ou pièce justificative visée n'a été jointe à cette dépense (restauration, transport, équipement)."}
          </p>
        )}

        {canManage && (
          <form action={attachProof} className="border-t border-border pt-3">
            <label className="block text-xs font-medium text-foreground mb-1.5">
              {expense.document
                ? (locale === "ar" ? "استبدال / تحديث الفاتورة المختومة" : "Remplacer la facture visée")
                : (locale === "ar" ? "إرفاق فاتورة مختومة من الجهة المستفيدة" : "Joindre la facture visée du bénéficiaire")}
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="file"
                name="receiptFile"
                required
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-medium hover:file:bg-muted/80 flex-1"
              />
              <Button type="submit" size="sm" variant="outline" className="shrink-0 gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                <span>{locale === "ar" ? "رفع الفاتورة المختومة" : "Téléverser"}</span>
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {locale === "ar"
                ? "يجب إرفاق فاتورة أو وصل مختوم وموقّع من الجهة المستفيدة (الفندق، المطعم، شركة النقل، أو متجر العتاد الرياضي)."
                : "Veuillez joindre la facture ou le reçu tamponné et signé par le bénéficiaire (transport, restauration, équipement)."}
            </p>
          </form>
        )}
      </section>

      {/* ------------------------------------------------------- Treasury movement */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">{t("treasuryMovement")}</h2>

        {payment ? (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t("fields.reference")}</dt>
                <dd>
                  <Link
                    href={`/${locale}/dashboard/finance/treasury/${payment.treasuryAccountId}/transactions/${payment.id}`}
                    className="font-mono text-club-primary underline"
                  >
                    {payment.referenceNumber}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("fields.account")}</dt>
                <dd>
                  <Link href={`/${locale}/dashboard/finance/treasury/${payment.treasuryAccountId}`} className="text-club-primary underline">
                    {payment.treasuryAccount.name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("fields.transactionType")}</dt>
                <dd>{t(`transactionTypes.${payment.type}` as any)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("fields.amount")}</dt>
                <dd className="font-semibold">{payment.amount.toLocaleString(locale)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("fields.date")}</dt>
                <dd>{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(payment.transactionDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("fields.balanceBefore")} → {t("fields.balanceAfter")}</dt>
                <dd>
                  {payment.balanceBefore.toLocaleString(locale)} → {payment.balanceAfter.toLocaleString(locale)}
                </dd>
              </div>
            </dl>
            {payment.reversedBy && (
              <p className="rounded-md bg-amber-50 p-3 text-amber-900">
                {t("paymentReversedNote")}{" "}
                <Link
                  href={`/${locale}/dashboard/finance/treasury/${payment.treasuryAccountId}/transactions/${payment.reversedBy.id}`}
                  className="font-mono underline"
                >
                  {payment.reversedBy.referenceNumber}
                </Link>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{isPosted ? t("noMovementYet") : isDraft ? t("postFirst") : t("noMovementCancelled")}</p>

            {canRecordPayment && (
              <form action={pay} className="grid grid-cols-2 gap-4 rounded-md border border-border p-4">
                <p className="col-span-2 text-xs text-muted-foreground">{t("paymentHelp")}</p>
                {/* Server-generated per render: a double-submit of THIS form carries the same key and cannot post twice. */}
                <input type="hidden" name="idempotencyKey" value={nanoid()} />
                <div className="col-span-2 md:col-span-1">
                  <label className="mb-1 block text-sm font-medium">{t("payFromAccount")}</label>
                  {accounts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("noActiveAccount")}</p>
                  ) : (
                    <select name="treasuryAccountId" required defaultValue="" className={inputClass}>
                      <option value="" disabled>
                        {t("selectAccount")}
                      </option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({(balances.get(a.id) ?? 0).toLocaleString(locale)})
                        </option>
                      ))}
                    </select>
                  )}
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
                  <label className="mb-1 block text-sm font-medium">{t("fields.amount")}</label>
                  <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{expense.amount.toLocaleString(locale)}</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{t("fields.description")}</label>
                  <input name="description" maxLength={500} defaultValue={expense.description.slice(0, 500)} className={inputClass} />
                </div>
                <div className="col-span-2">
                  <Button type="submit" disabled={accounts.length === 0}>
                    {t("recordPayment")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- Draft editing */}
      {isDraft && canManage && editOptions && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("editExpense")}</h2>
          <form action={update} className="grid grid-cols-2 gap-4">
            <ExpenseFormFields
              locale={locale}
              defaults={{
                description: expense.description,
                amount: expense.amount,
                date: expense.date,
                category: expense.category,
                paymentMethod: expense.paymentMethod,
                payeeName: expense.payeeName,
                teamId: expense.teamId,
                seasonId: expense.seasonId,
                budgetId: expense.budgetId,
                relatedMatchId: expense.relatedMatchId,
                relatedTrainingId: expense.relatedTrainingId,
                notes: expense.notes
              }}
              options={{ seasons: editOptions[0], teams: editOptions[1], budgets: editOptions[2], matches: matchOptions, trainingSessions: editOptions[4] }}
            />
            <div className="col-span-2">
              <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
            </div>
          </form>
        </section>
      )}

      {/* ---------------------------------------------- Official generated documents */}
      {canGenerate && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("relatedDocuments")}</h2>
          {isPosted ? (
            statementVersions.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {statementVersions.map((v) => (
                  <Link
                    key={v.id}
                    href={`/${locale}/dashboard/generated-documents/new/${v.id}?entityId=${expense.id}`}
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-club-primary hover:bg-muted"
                  >
                    {t("generateStatement")} — {v.template.name} (v{v.versionNumber})
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-xs text-muted-foreground">{t("noActiveStatementTemplate")}</p>
            )
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">{t("statementRequiresPosted")}</p>
          )}
          <ul className="divide-y divide-border text-sm">
            {generatedDocuments.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/${locale}/dashboard/generated-documents/${g.id}`} className="text-club-primary underline">
                  {g.templateVersion.template.name} — {tTemplates(`types.${g.templateVersion.template.type}` as any)}
                </Link>
                <span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(g.createdAt)}</span>
              </li>
            ))}
            {generatedDocuments.length === 0 && <li className="py-2 text-muted-foreground">{t("noGeneratedDocuments")}</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
