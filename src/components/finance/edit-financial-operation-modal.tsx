"use client";

import { useState } from "react";
import { Edit2, X, Save, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { parseDMYToDate } from "@/lib/date-utils";
import { useRouter } from "next/navigation";
import { programmerUpdateTransactionAction } from "@/app/[locale]/(dashboard)/dashboard/finance/treasury/actions";
import { programmerUpdateExpenseAction } from "@/app/[locale]/(dashboard)/dashboard/finance/expenses/actions";
import type { UnifiedFinancialOperation } from "./financial-operations-table";

interface EditFinancialOperationModalProps {
  operation: UnifiedFinancialOperation;
  locale?: string;
  accounts?: { id: string; name: string }[];
}

export function EditFinancialOperationModal({
  operation,
  locale = "ar",
  accounts = []
}: EditFinancialOperationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const isAr = locale === "ar";

  // Pre-fill fields from current operation data
  const [type, setType] = useState<"DEPOSIT" | "WITHDRAWAL" | "EXPENSE">(operation.type);
  const [amount, setAmount] = useState<number>(operation.amount);
  const [date, setDate] = useState<string>(
    operation.date ? new Date(operation.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState<string>(operation.description);
  const [beneficiary, setBeneficiary] = useState<string>(operation.beneficiary || "");
  const [nationalIdNumber, setNationalIdNumber] = useState<string>(operation.nationalIdNumber || "");
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    operation.treasuryAccountId || (accounts[0]?.id ?? "")
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      toast.error(isAr ? "المبلغ يجب أن يكون رقماً صحيحاً وموجباً" : "Montant invalide");
      return;
    }

    setIsPending(true);
    try {
      const parsedDate = parseDMYToDate(date) || new Date();
      if (operation.type === "EXPENSE") {
        await programmerUpdateExpenseAction({
          expenseId: operation.id,
          amount: Math.round(Number(amount)),
          date: parsedDate,
          description: description.trim(),
          payeeName: beneficiary.trim() || undefined
        });
      } else {
        // Build updated description preserving [المعني] and [CNI] badges if provided
        let fullDesc = description.trim();
        if (beneficiary.trim()) {
          fullDesc += ` [المعني: ${beneficiary.trim()}]`;
        }
        if (nationalIdNumber.trim()) {
          fullDesc += ` [CNI: ${nationalIdNumber.trim()}]`;
        }

        await programmerUpdateTransactionAction({
          transactionId: operation.id,
          type: type as "DEPOSIT" | "WITHDRAWAL",
          amount: Math.round(Number(amount)),
          transactionDate: parsedDate,
          description: fullDesc,
          treasuryAccountId: selectedAccountId || operation.treasuryAccountId!
        });
      }

      toast.success(isAr ? "تم تعديل العملية المالية بنجاح" : "Opération financière modifiée avec succès");
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || (isAr ? "حدث خطأ أثناء تعديل العملية" : "Erreur lors de la modification"));
    } finally {
      setIsPending(false);
    }
  };

  const inputClass =
    "h-11 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={isAr ? "تعديل العملية المالية" : "Modifier l'opération"}
        aria-label={isAr ? "تعديل العملية" : "Modifier"}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-2xs"
      >
        <Edit2 className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
        >
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={() => !isPending && setIsOpen(false)} />

          {/* Modal Container */}
          <div className="relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3.5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground">
                    {isAr ? "تعديل العملية المالية" : "Modifier l'opération financière"}
                  </h3>
                  <span dir="ltr" className="mt-0.5 block truncate text-start font-mono text-[11px] text-muted-foreground">
                    {operation.referenceNumber}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable form body and fixed actions footer */}
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
              <div className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="min-w-0 flex-1 whitespace-normal text-start [overflow-wrap:anywhere]">
                  {isAr
                    ? "تعديل / حذف: تُحفظ التعديلات في سجل العملية ويُحدَّث الوصل، مع توثيق القيم السابقة والجديدة في سجل العمليات."
                    : "Action développeur : Toute modification met à jour la base de données, le bon officiel et est tracée dans le journal d'audit."}
                </span>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                {/* Type Selection */}
                <div className="min-w-0 space-y-1.5">
                  <label htmlFor="financial-operation-type" className="block text-xs font-semibold text-foreground">
                    {isAr ? "نوع العملية *" : "Type de l'opération *"}
                  </label>
                  {operation.type === "EXPENSE" ? (
                    <input
                      type="text"
                      disabled
                      value={isAr ? "مصاريف / فاتورة صرف" : "Dépense"}
                      className={`${inputClass} bg-muted opacity-80 cursor-not-allowed`}
                    />
                  ) : (
                    <select
                      id="financial-operation-type"
                      value={type}
                      onChange={(e) => setType(e.target.value as "DEPOSIT" | "WITHDRAWAL")}
                      className={inputClass}
                      required
                    >
                      <option value="DEPOSIT">{isAr ? "إيداع رسمي (Dépôt)" : "Dépôt"}</option>
                      <option value="WITHDRAWAL">{isAr ? "سحب نقدي" : "Retrait"}</option>
                    </select>
                  )}
                </div>

                {/* Amount */}
                <div className="min-w-0 space-y-1.5">
                  <label htmlFor="financial-operation-amount" className="block text-xs font-semibold text-foreground">
                    {isAr ? "المبلغ (دج) *" : "Montant (DZD) *"}
                  </label>
                  <input
                    id="financial-operation-amount"
                    type="number"
                    min={1}
                    step={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className={inputClass}
                    required
                  />
                </div>

                {/* Date */}
                <div className="min-w-0">
                  <DateInput
                    label={isAr ? "تاريخ العملية" : "Date"}
                    value={date}
                    onChange={(dmy) => setDate(dmy)}
                    required
                    locale={locale}
                  />
                </div>

                {/* Account (for Treasury movements) */}
                {operation.type !== "EXPENSE" && accounts.length > 0 && (
                  <div className="min-w-0 space-y-1.5">
                    <label htmlFor="financial-operation-account" className="block text-xs font-semibold text-foreground">
                      {isAr ? "الحساب المالي *" : "Compte de trésorerie *"}
                    </label>
                    <select
                      id="financial-operation-account"
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className={inputClass}
                      required
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Beneficiary / Concerné */}
                <div className="min-w-0 space-y-1.5">
                  <label htmlFor="financial-operation-beneficiary" className="block text-xs font-semibold text-foreground">
                    {isAr ? "المعني بالعملية / المستفيد" : "Bénéficiaire / Concerné"}
                  </label>
                  <input
                    id="financial-operation-beneficiary"
                    type="text"
                    value={beneficiary}
                    onChange={(e) => setBeneficiary(e.target.value)}
                    placeholder={isAr ? "اسم الشخص أو الجهة المعنية..." : "Nom du bénéficiaire..."}
                    className={inputClass}
                  />
                </div>

                {/* National ID (CNI) */}
                <div className="min-w-0 space-y-1.5">
                  <label htmlFor="financial-operation-national-id" className="block text-xs font-semibold text-foreground">
                    {isAr ? "رقم بطاقة التعريف الوطنية (CNI)" : "N° Carte Nationale (CNI)"}
                  </label>
                  <input
                    id="financial-operation-national-id"
                    type="text"
                    value={nationalIdNumber}
                    onChange={(e) => setNationalIdNumber(e.target.value)}
                    placeholder={isAr ? "10 أرقام أو رقم بطاقة التعريف..." : "10 chiffres ou numéro de carte..."}
                    className={inputClass}
                  />
                </div>

                {/* Description */}
                <div className="min-w-0 space-y-1.5 md:col-span-2">
                  <label htmlFor="financial-operation-description" className="block text-xs font-semibold text-foreground">
                    {isAr ? "البيان / الغرض من العملية *" : "Description / Objet *"}
                  </label>
                  <textarea
                    id="financial-operation-description"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`${inputClass} h-auto min-h-24 resize-y py-3 leading-relaxed`}
                    required
                  />
                </div>
              </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setIsOpen(false)}
                  className="h-10 rounded-xl px-4 text-xs"
                >
                  {isAr ? "إلغاء" : "Annuler"}
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="h-10 gap-2 rounded-xl px-4 text-xs font-bold shadow-sm"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{isAr ? "جارٍ الحفظ..." : "Enregistrement..."}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>{isAr ? "حفظ التعديلات" : "Enregistrer"}</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
