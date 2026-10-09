"use client";

import { useState } from "react";
import { Edit3, Check, X, Loader2, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateOpeningBalanceAction } from "@/app/[locale]/(dashboard)/dashboard/finance/treasury/actions";
import { toast } from "sonner";

interface EditOpeningBalanceModalProps {
  accountId: string;
  accountName: string;
  currentBalance: number;
  locale?: string;
}

export function EditOpeningBalanceModal({
  accountId,
  accountName,
  currentBalance,
  locale = "ar"
}: EditOpeningBalanceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [balance, setBalance] = useState(currentBalance.toString());
  const [loading, setLoading] = useState(false);
  const isAr = locale === "ar";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(balance, 10);
    if (isNaN(num) || num < 0) {
      toast.error(isAr ? "أدخل مبلغاً صحيحاً لا يقل عن صفر" : "Saisissez un montant valide supérieur ou égal à zéro");
      return;
    }

    setLoading(true);
    try {
      await updateOpeningBalanceAction(accountId, num);
      toast.success(isAr ? "تم حفظ الإعانة وتحديث الرصيد" : "Subvention enregistrée et solde mis à jour");
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to update opening balance:", err);
      toast.error(isAr ? "تعذر حفظ الإعانة. أعد المحاولة أو تحقق من صلاحيتك." : "Impossible d’enregistrer la subvention. Réessayez ou vérifiez vos droits.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setBalance(currentBalance.toString());
          setIsOpen(true);
        }}
        className="gap-1.5 text-xs border-dashed hover:border-primary"
      >
        <Edit3 className="h-3 w-3 text-primary" />
        <span>{isAr ? "تعديل الإعانة" : "Modifier la subvention"}</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) setIsOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="opening-balance-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/20 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Coins className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 id="opening-balance-title" className="text-base font-bold text-foreground">{isAr ? "تعديل الإعانة" : "Modifier la subvention"}</h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{accountName}</p>
                </div>
              </div>
              <button type="button" aria-label={isAr ? "إغلاق النافذة" : "Fermer"} onClick={() => setIsOpen(false)} disabled={loading} className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-5">
              <div className="space-y-2">
                <label htmlFor="opening-balance-amount" className="block text-sm font-semibold text-foreground">
                  {isAr ? "مبلغ الإعانة الجديد" : "Nouveau montant de la subvention"}
                </label>
                <div className="relative">
                  <input id="opening-balance-amount" type="number" min="0" step="1" required autoFocus value={balance} onChange={(e) => setBalance(e.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 pe-16 text-base font-mono font-semibold tabular-nums text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <span aria-hidden="true" className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">{isAr ? "د.ج" : "DZD"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isAr ? "الرصيد الحالي:" : "Solde actuel :"} <span dir="ltr" className="font-mono font-semibold tabular-nums">{new Intl.NumberFormat(locale).format(currentBalance)} {isAr ? "د.ج" : "DZD"}</span>
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={loading} className="sm:min-w-24">
                  {isAr ? "إلغاء" : "Annuler"}
                </Button>
                <Button type="submit" disabled={loading} className="gap-2 sm:min-w-36">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>{loading ? (isAr ? "جارٍ الحفظ..." : "Enregistrement…") : (isAr ? "حفظ" : "Enregistrer")}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
