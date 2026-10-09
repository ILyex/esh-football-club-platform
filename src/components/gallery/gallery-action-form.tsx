"use client";

import type { FormHTMLAttributes, ReactNode } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function GalleryActionForm({
  action,
  successMessage,
  errorMessage,
  redirectTo,
  children,
  ...props
}: {
  action: (formData: FormData) => Promise<unknown>;
  successMessage: string;
  errorMessage: string;
  redirectTo?: string;
  children: ReactNode;
} & Omit<FormHTMLAttributes<HTMLFormElement>, "action">) {
  const router = useRouter();

  return (
    <form
      {...props}
      action={async (formData) => {
        try {
          await action(formData);
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
