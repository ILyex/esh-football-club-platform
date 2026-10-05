"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
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
  body
}: {
  children: ReactNode;
  onConfirm: () => void | Promise<void>;
  title?: string;
  body?: string;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="mb-2 text-base font-semibold">{title ?? t("confirmDeleteTitle")}</h2>
            <p className="mb-6 text-sm text-muted-foreground">{body ?? t("confirmDeleteBody")}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  await onConfirm();
                  setPending(false);
                  setOpen(false);
                }}
              >
                {t("confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
