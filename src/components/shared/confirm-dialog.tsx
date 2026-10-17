"use client";

import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// A real confirmation step before any destructive action (spec section 49:
// deleting a player must never fire immediately). Usage:
//
//   <ConfirmDialog onConfirm={() => deletePlayerAction(id)}>
//     <Button variant="destructive">{t("delete")}</Button>
//   </ConfirmDialog>
export function ConfirmDialog({
  children,
  onConfirm,
  title,
  body,
  successMessage,
  errorMessage
}: {
  children: ReactNode;
  onConfirm: () => unknown | Promise<unknown>;
  title?: string;
  body?: string;
  successMessage?: string;
  errorMessage?: string;
}) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, pending]);

  async function confirm() {
    setPending(true);
    try {
      const result = await onConfirm();
      if (result && typeof result === "object" && "success" in result && (result as { success?: unknown }).success === false) {
        const message = "error" in result && typeof (result as { error?: unknown }).error === "string"
          ? (result as { error: string }).error
          : (errorMessage ?? (isAr ? "لم يتم الحذف" : "La suppression a échoué"));
        toast.error(message);
        return;
      }
      toast.success(successMessage ?? (isAr ? "تم الحذف بنجاح" : "Supprimé avec succès"));
      setOpen(false);
    } catch (error) {
      const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
      if (!digest.startsWith("NEXT_REDIRECT")) {
        toast.error(errorMessage ?? (isAr ? "لم يتم الحذف" : "La suppression a échoué"));
      } else {
        throw error;
      }
      // The failure has been reported to the user; keep the dialog available for retry.
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm animate-in fade-in duration-150"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setOpen(false);
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-black/40 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            dir={isAr ? "rtl" : "ltr"}
          >
            <div className="flex items-start gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="pt-0.5 text-base font-bold text-foreground sm:text-lg">
                  {title ?? t("confirmDeleteTitle")}
                </h2>
                <p id={bodyId} className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {body ?? t("confirmDeleteBody")}
                </p>
              </div>
              <button
                type="button"
                className="-mt-1 -ml-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                onClick={() => setOpen(false)}
                disabled={pending}
                aria-label={t("cancel")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-start sm:px-6">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending} className="w-full sm:w-auto">
                {t("cancel")}
              </Button>
              <Button variant="destructive" disabled={pending} onClick={confirm} className="w-full sm:w-auto">
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
