"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, Loader2, LogOut, Pencil, Trash2, X } from "lucide-react";
import { deleteUserAction, terminateSessionAction } from "@/app/[locale]/(dashboard)/dashboard/users/actions";

export function UserListActions({
  userId,
  locale,
  deleteLabel,
  editLabel,
  confirmMessage,
  canTerminateSession,
  terminateSessionLabel,
  confirmTerminateSession,
  cancelLabel
}: {
  userId: string;
  locale: string;
  deleteLabel: string;
  editLabel: string;
  confirmMessage: string;
  canTerminateSession: boolean;
  terminateSessionLabel: string;
  confirmTerminateSession: string;
  cancelLabel: string;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<"delete" | "terminate" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (confirmation) dialogRef.current?.focus();
  }, [confirmation]);

  useEffect(() => {
    if (!confirmation) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setConfirmation(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmation, pending]);

  const closeConfirmation = () => {
    if (!pending) {
      setError(false);
      setConfirmation(null);
    }
  };

  const confirmAction = async () => {
    if (!confirmation || pending) return;
    setPending(true);
    setError(false);
    try {
      if (confirmation === "delete") await deleteUserAction(userId);
      else await terminateSessionAction(userId);
      setConfirmation(null);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  const isDeleting = confirmation === "delete";
  const dialogTitle = isDeleting ? deleteLabel : terminateSessionLabel;
  const dialogDescription = isDeleting ? confirmMessage : confirmTerminateSession;
  const actionLabel = isDeleting ? deleteLabel : terminateSessionLabel;

  return (
    <>
      <div className="mx-auto flex w-fit flex-nowrap items-center justify-center gap-2">
        <Link
          href={`/${locale}/dashboard/users/${userId}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-club-primary/40 hover:bg-muted"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          {editLabel}
        </Link>
        <button
          type="button"
          onClick={() => setConfirmation("delete")}
          aria-label={deleteLabel}
          title={deleteLabel}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/5 text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {canTerminateSession && (
          <button
            type="button"
            onClick={() => setConfirmation("terminate")}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-club-primary/25 bg-club-primary/5 px-2.5 text-xs font-semibold text-club-primary transition-colors hover:bg-club-primary/10"
            title={terminateSessionLabel}
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            {terminateSessionLabel}
          </button>
        )}
      </div>

      {confirmation && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConfirmation();
          }}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="user-action-dialog-title"
            aria-describedby="user-action-dialog-description"
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl outline-none animate-in zoom-in-95 duration-150 sm:p-6"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
                {isDeleting ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id="user-action-dialog-title" className="text-base font-bold text-foreground">
                  {dialogTitle}
                </h2>
                <p id="user-action-dialog-description" className="mt-2 text-sm leading-6 text-muted-foreground">
                  {dialogDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={pending}
                aria-label={cancelLabel}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                {locale === "ar" ? "تعذر تنفيذ الإجراء. حدّث الصفحة وحاول مجددًا." : "Action impossible. Actualisez la page et réessayez."}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={pending}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => void confirmAction()}
                disabled={pending}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-destructive px-4 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {pending ? (locale === "ar" ? "جارٍ التنفيذ..." : "Traitement...") : actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
