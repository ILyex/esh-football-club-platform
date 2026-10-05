import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { runFinanceAction, withNotice } from "@/lib/finance/action-notice";
import { reverseTransactionAction } from "../../../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { NoticeToast } from "@/components/shared/notice-toast";
import { FileText, FileCheck, Download } from "lucide-react";

export default async function TreasuryTransactionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; id: string; transactionId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { locale, id, transactionId } = await params;
  const { notice } = await searchParams;
  const user = await requirePermission("finance.view");
  const t = await getTranslations("finance");
  const tCommon = await getTranslations("common");
  const tTemplates = await getTranslations("templates");

  const canApprove = hasPermission(user, "finance.approve");
  const canGenerate = canApprove && hasPermission(user, "documents.generate");

  const transaction = await db.treasuryTransaction.findUnique({
    where: { id: transactionId },
    include: {
      treasuryAccount: true,
      relatedExpense: { select: { id: true, referenceNumber: true, description: true, status: true } },
      reversalOfTransaction: { select: { id: true, referenceNumber: true } },
      reversedBy: { select: { id: true, referenceNumber: true } },
      createdBy: { select: { name: true } },
      document: true
    }
  });
  // The account in the URL must be the transaction's own account — a mismatched
  // pair is treated as "not found", not silently corrected.
  if (!transaction || transaction.treasuryAccountId !== id) notFound();

  const isReversal = transaction.reversalOfTransactionId !== null;
  const isReversed = transaction.reversedBy !== null;
  const canReverse = canApprove && !isReversal && !isReversed;
  const receiptEligible = !isReversal && !isReversed;
  const receiptType = transaction.type === "DEPOSIT" ? "DEPOSIT_RECEIPT" : "WITHDRAWAL_RECEIPT";

  const [receiptVersions, generatedDocuments] = await Promise.all([
    canGenerate && receiptEligible
      ? db.documentTemplateVersion.findMany({ where: { status: "ACTIVE", template: { type: receiptType } }, include: { template: true }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    canGenerate
      ? db.generatedDocument.findMany({
          where: { relatedEntityType: "TreasuryTransaction", relatedEntityId: transactionId },
          include: { templateVersion: { include: { template: true } } },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([])
  ]);

  const accountBase = `/${locale}/dashboard/finance/treasury/${id}`;
  const base = `${accountBase}/transactions/${transactionId}`;

  async function reverse() {
    "use server";
    const result = await runFinanceAction(() => reverseTransactionAction(transactionId, id));
    redirect(withNotice(base, result.ok ? "finance.success.transactionReversed" : result.notice));
  }

  const dash = "—";

  return (
    <div className="max-w-3xl space-y-6">
      <NoticeToast notice={notice} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-semibold">{transaction.referenceNumber}</h1>
          <Badge tone={transaction.type === "DEPOSIT" ? "success" : "warning"}>{t(`transactionTypes.${transaction.type}` as any)}</Badge>
          {isReversal && <Badge tone="neutral">{t("reversalEntry")}</Badge>}
          {isReversed && <Badge tone="danger">{t("reversed")}</Badge>}
        </div>
        <Link href={accountBase} className="text-sm text-club-primary underline">
          {t("backToAccount")}
        </Link>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.reference")}</dt>
            <dd className="font-mono">{transaction.referenceNumber}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.transactionType")}</dt>
            <dd>{t(`transactionTypes.${transaction.type}` as any)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.amount")}</dt>
            <dd className="font-semibold">{transaction.amount.toLocaleString(locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.date")}</dt>
            <dd>{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(transaction.transactionDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.account")}</dt>
            <dd>
              <Link href={accountBase} className="text-club-primary underline">
                {transaction.treasuryAccount.name}
              </Link>
            </dd>
          </div>
          <div className="col-span-2 md:col-span-3">
            <dt className="text-xs text-muted-foreground">{t("fields.description")}</dt>
            <dd>{transaction.description || dash}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.balanceBefore")}</dt>
            <dd>{transaction.balanceBefore.toLocaleString(locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.balanceAfter")}</dt>
            <dd>{transaction.balanceAfter.toLocaleString(locale)}</dd>
          </div>
          <div className="col-span-2 md:col-span-3 text-xs text-muted-foreground">{t("snapshotNote")}</div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.relatedExpense")}</dt>
            <dd>
              {transaction.relatedExpense ? (
                <Link href={`/${locale}/dashboard/finance/expenses/${transaction.relatedExpense.id}`} className="font-mono text-club-primary underline">
                  {transaction.relatedExpense.referenceNumber}
                </Link>
              ) : (
                dash
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("reversalOf")}</dt>
            <dd>
              {transaction.reversalOfTransaction ? (
                <Link href={`${accountBase}/transactions/${transaction.reversalOfTransaction.id}`} className="font-mono text-club-primary underline">
                  {transaction.reversalOfTransaction.referenceNumber}
                </Link>
              ) : (
                dash
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("reversedBy")}</dt>
            <dd>
              {transaction.reversedBy ? (
                <Link href={`${accountBase}/transactions/${transaction.reversedBy.id}`} className="font-mono text-club-primary underline">
                  {transaction.reversedBy.referenceNumber}
                </Link>
              ) : (
                dash
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("fields.createdBy")}</dt>
            <dd>
              {transaction.createdBy.name} — {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(transaction.createdAt)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {canReverse && (
            <ConfirmDialog onConfirm={reverse} title={t("confirmReverseTitle")} body={t("confirmReverseBody")}>
              <Button type="button" variant="outline">
                {t("reverse")}
              </Button>
            </ConfirmDialog>
          )}
          {isReversal && <p className="text-xs text-muted-foreground">{t("reversalNotReversible")}</p>}
          {isReversed && <p className="text-xs text-muted-foreground">{t("alreadyReversedNote")}</p>}
        </div>
      </section>

      {/* ------------------------------------------------ Supporting Stamped Proof / Invoice */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-club-primary" />
            {t("supportingDocument")}
          </h2>
          {transaction.document && (
            <Badge tone="success">{locale === "ar" ? "فاتورة / وصل معتمد" : "Justificatif validé"}</Badge>
          )}
        </div>

        {transaction.document ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">{transaction.document.name}</p>
                <p className="text-xs text-muted-foreground">
                  {transaction.document.originalName} • {(transaction.document.sizeBytes >> 10) || 1} KB
                </p>
              </div>
            </div>
            <a
              href={`/api/documents/${transaction.document.id}/download`}
              className="inline-flex items-center gap-1.5 rounded-md bg-club-primary px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-club-primary/90"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{tCommon("download")}</span>
            </a>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {locale === "ar"
              ? "لم يتم إرفاق إثبات مالي مختوم لهذه الحركة عند تسجيلها (فاتورة، إشعار بنكي، وصل إعانة البلدية أو دعم المحبين)."
              : "Aucun justificatif financier visé joint lors de l'enregistrement de cette opération."}
          </p>
        )}
      </section>

      {canGenerate && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("relatedDocuments")}</h2>
          {receiptEligible ? (
            receiptVersions.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {receiptVersions.map((v) => (
                  <Link
                    key={v.id}
                    href={`/${locale}/dashboard/generated-documents/new/${v.id}?entityId=${transaction.id}`}
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-club-primary hover:bg-muted"
                  >
                    {transaction.type === "DEPOSIT" ? t("generateDepositReceipt") : t("generateWithdrawalReceipt")} — {v.template.name} (v{v.versionNumber})
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-xs text-muted-foreground">{t("noActiveReceiptTemplate")}</p>
            )
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">{t("receiptNotEligible")}</p>
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
            {generatedDocuments.length === 0 && <li className="py-2 text-muted-foreground">{tCommon("noResults")}</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
