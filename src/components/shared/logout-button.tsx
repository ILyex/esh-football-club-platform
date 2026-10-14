"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { clearPresenceAction } from "@/app/[locale]/(dashboard)/dashboard/presence-actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export interface LogoutButtonProps {
  locale: string;
  className?: string;
  variant?: "pill" | "icon" | "menuItem";
}

export function LogoutButton({ locale, className = "", variant = "pill" }: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const isAr = locale === "ar";
  const label = isAr ? "تسجيل الخروج" : "Déconnexion";
  const confirmation = isAr ? "هل أنت متأكد أنك تريد تسجيل الخروج؟" : "Voulez-vous vraiment vous déconnecter ?";

  const handleLogout = async () => {
    try {
      setLoading(true);
      await clearPresenceAction().catch(() => {});
      await signOut({ callbackUrl: `/${locale}/login` });
    } catch (e) {
      console.error("Logout error", e);
      window.location.href = `/${locale}/login`;
    }
  };

  const confirmLogout = (button: ReactNode) => (
    <ConfirmDialog
      title={isAr ? "تأكيد تسجيل الخروج" : "Confirmer la déconnexion"}
      body={confirmation}
      successMessage={isAr ? "تم تسجيل الخروج" : "Déconnexion réussie"}
      errorMessage={isAr ? "تعذر تسجيل الخروج" : "La déconnexion a échoué"}
      onConfirm={handleLogout}
    >
      {button}
    </ConfirmDialog>
  );

  if (variant === "icon") {
    return confirmLogout(
      <button
        type="button"
        disabled={loading}
        title={label}
        aria-label={label}
        className={`inline-flex items-center justify-center rounded-xl border border-border bg-card p-2 text-muted-foreground hover:border-destructive/60 hover:text-destructive hover:bg-destructive/5 transition-colors shadow-2xs cursor-pointer ${className}`}
      >
        <LogOut className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
      </button>
    );
  }

  if (variant === "menuItem") {
    return confirmLogout(
      <button
        type="button"
        disabled={loading}
        className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer ${className}`}
      >
        <LogOut className="h-3.5 w-3.5" />
        <span>{label}</span>
      </button>
    );
  }

  return confirmLogout(
    <button
      type="button"
      disabled={loading}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-destructive/60 hover:text-destructive hover:bg-destructive/5 transition-all shadow-2xs cursor-pointer ${className}`}
    >
      <LogOut className={`h-3.5 w-3.5 ${loading ? "animate-pulse" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
