"use client";

import { useState } from "react";
import { LogOut, Loader2, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { terminateSessionAction } from "@/app/[locale]/(dashboard)/dashboard/users/actions";

interface TerminateSessionButtonProps {
  userId: string;
  userName: string;
  locale?: string;
  variant?: "default" | "outline" | "destructive" | "ghost";
  size?: "default" | "sm" | "icon";
  buttonLabel?: string;
  className?: string;
}

export function TerminateSessionButton({
  userId,
  userName,
  locale = "ar",
  variant = "destructive",
  size = "sm",
  buttonLabel,
  className
}: TerminateSessionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isAr = locale === "ar";

  async function handleTerminate() {
    setLoading(true);
    try {
      await terminateSessionAction(userId);
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to terminate user session:", err);
    } finally {
      setLoading(false);
    }
  }

  const label = buttonLabel || (isAr ? "إنهاء الجلسة" : "Fin de session");

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
        className={`${size === "icon" ? "h-7 w-7 p-0" : "gap-1.5 text-xs"} ${className ?? ""}`}
        title={label}
        aria-label={label}
      >
        <LogOut className="h-3.5 w-3.5" />
        {size !== "icon" && <span>{label}</span>}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 end-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive border border-destructive/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {isAr ? "تأكيد إلغاء جلسة المستخدم فورياً" : "Confirmer la révocation de session"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {isAr
                    ? `سيتم إبطال جميع الرموز الأمنية (JWT) لحساب "${userName}" فورياً، وسيتم تسجيل خروجه من جميع الأجهزة والمتصفحات فور المحاولة القادمة.`
                    : `Tous les jetons de session actifs pour "${userName}" seront immédiatement révoqués. L'utilisateur sera déconnecté sur tous ses appareils.`}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={loading}
              >
                {isAr ? "إلغاء" : "Annuler"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleTerminate}
                disabled={loading}
                className="gap-1.5"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isAr ? "تأكيد إنهاء الجلسة الآن" : "Confirmer la fin de session"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
