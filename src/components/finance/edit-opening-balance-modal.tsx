"use client";

import { useState } from "react";
import { Edit3, Check, X, Loader2, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateOpeningBalanceAction } from "@/app/[locale]/(dashboard)/dashboard/finance/treasury/actions";

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
    if (isNaN(num)) return;

    setLoading(true);
    try {
      await updateOpeningBalanceAction(accountId, num);
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to update opening balance:", err);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 end-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {isAr ? "تعديل الإعانة" : "Modifier la subvention"}
                </h3>
                <p className="text-[11px] text-muted-foreground">{accountName}</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  {isAr ? "مبلغ الإعانة الجديد (دج)" : "Nouveau montant de la subvention (DZD)"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background py-2.5 ps-12 pe-3.5 text-sm font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    {isAr ? "دج" : "DZD"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                >
                  {isAr ? "إلغاء" : "Annuler"}
                </Button>
                <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>{isAr ? "حفظ وتحديث الرصيد" : "Enregistrer"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
