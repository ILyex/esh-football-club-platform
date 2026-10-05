"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { programmerDeleteTransactionAction } from "@/app/[locale]/(dashboard)/dashboard/finance/treasury/actions";
import { programmerDeleteExpenseAction } from "@/app/[locale]/(dashboard)/dashboard/finance/expenses/actions";
import type { UnifiedFinancialOperation } from "./financial-operations-table";

interface DeleteFinancialOperationDialogProps {
  operation: UnifiedFinancialOperation;
  locale?: string;
}

export function DeleteFinancialOperationDialog({
  operation,
  locale = "ar"
}: DeleteFinancialOperationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const isAr = locale === "ar";

  const currencySuffix = isAr ? " دج" : " DZD";
  const formattedAmount = operation.amount.toLocaleString(locale) + currencySuffix;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (operation.type === "EXPENSE") {
        await programmerDeleteExpenseAction({ expenseId: operation.id });
      } else {
        await programmerDeleteTransactionAction({ transactionId: operation.id });
      }

      toast.success(
        isAr ? "تم حذف العملية المالية وتوثيقها في سجل الرقابة بنجاح" : "Opération financière supprimée avec succès"
      );
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || (isAr ? "حدث خطأ أثناء حذف العملية" : "Erreur lors de la suppression"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={isAr ? "حذف العملية المالية (المبرمج فقط)" : "Supprimer l'opération"}
        aria-label={isAr ? "حذف العملية" : "Supprimer"}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 bg-background hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-all shadow-2xs"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
        >
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={() => !isDeleting && setIsOpen(false)} />

          {/* Dialog Container */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-red-500/30 bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  {isAr ? "هل أنت متأكد من حذف هذه العملية المالية؟" : "Confirmer la suppression de cette opération ?"}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr
                    ? "سيُحذف السجل المالي وتُوثق تفاصيله السابقة في سجل العمليات لضمان الشفافية وإمكانية المراجعة."
                    : "Action développeur uniquement. Cette suppression sera intégralement consignée dans le journal d'audit."}
                </p>
              </div>
            </div>

            {/* Operation summary box */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1.5 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{isAr ? "المرجع:" : "Référence :"}</span>
                <span className="font-mono font-bold text-foreground">{operation.referenceNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{isAr ? "المبلغ:" : "Montant :"}</span>
                <span className="font-mono font-bold text-foreground">{formattedAmount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{isAr ? "البيان:" : "Objet :"}</span>
                <span className="text-foreground truncate max-w-[200px]">{operation.description}</span>
              </div>
            </div>

            {/* Confirmation actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setIsOpen(false)}
                className="text-xs"
              >
                {isAr ? "إلغاء" : "Annuler"}
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={handleDelete}
                className="gap-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{isAr ? "جارٍ الحذف..." : "Suppression..."}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{isAr ? "حذف العملية" : "Supprimer"}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
