"use client";

import type { FormHTMLAttributes, ReactNode } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function GalleryActionForm({
  action,
  successMessage,
  errorMessage,
  locale,
  redirectTo,
  children,
  ...props
}: {
  action: (formData: FormData) => Promise<unknown>;
  successMessage: string;
  errorMessage: string;
  locale?: string;
  redirectTo?: string;
  children: ReactNode;
} & Omit<FormHTMLAttributes<HTMLFormElement>, "action">) {
  const router = useRouter();

  return (
    <form
      {...props}
      action={async (formData) => {
        try {
          const result = await action(formData) as { error?: string } | undefined;
          if (result?.error === "team_required") {
            toast.error(locale === "fr" ? "Choisissez une équipe que vous gérez pour enregistrer l’album." : "اختر الفريق الذي تدير فئته لحفظ الألبوم.");
            return;
          }
          toast.success(successMessage);
          if (redirectTo) router.push(redirectTo);
          else router.refresh();
        } catch (error) {
          console.error("Gallery action failed:", error);
          toast.error(errorMessage);
        }
      }}
    >
      {children}
    </form>
  );
}
