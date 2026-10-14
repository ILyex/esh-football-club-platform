"use client";

import type { FormHTMLAttributes, ReactNode } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

/** Runs a server action and reports its actual outcome without relying on redirects. */
export function ActionFeedbackForm({
  action,
  successMessage,
  errorMessage,
  refreshOnSuccess = false,
  resetOnSuccess = false,
  encType,
  id,
  className,
  children
}: {
  action: (formData: FormData) => Promise<unknown>;
  successMessage: string;
  errorMessage: string;
  refreshOnSuccess?: boolean;
  resetOnSuccess?: boolean;
  encType?: FormHTMLAttributes<HTMLFormElement>["encType"];
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={async (formData) => {
      if (pending) return;
      setPending(true);
      try {
        const result = await action(formData);
        const formError = result && typeof result === "object" && "formError" in result
          ? (result as { formError?: { field?: string; message: string } }).formError
          : undefined;
        if (formError) {
          if (formError.field) {
            const fieldSelector = `[name="${CSS.escape(formError.field)}"]`;
            const field = (id ? document.getElementById(id)?.querySelector<HTMLElement>(fieldSelector) : null)
              ?? document.querySelector<HTMLElement>(fieldSelector);
            field?.focus();
            field?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          toast.error(formError.message);
          return;
        }
        if (result && typeof result === "object" && "success" in result && (result as { success?: unknown }).success === false) {
          const message = "error" in result && typeof (result as { error?: unknown }).error === "string"
            ? (result as { error: string }).error
            : errorMessage;
          toast.error(message);
          return;
        }
        if (result && typeof result === "object" && "changed" in result && (result as { changed?: unknown }).changed === false) {
          toast.info("noChangeMessage" in result && typeof (result as { noChangeMessage?: unknown }).noChangeMessage === "string"
            ? (result as { noChangeMessage: string }).noChangeMessage
            : successMessage);
          return;
        }
        toast.success(successMessage);
        if (result && typeof result === "object" && "warning" in result && typeof (result as { warning?: unknown }).warning === "string") {
          toast.warning((result as { warning: string }).warning, { duration: 7000 });
        }
        if (resetOnSuccess) formRef.current?.reset();
        if (refreshOnSuccess) router.refresh();
      } catch (error) {
        console.error("Form action failed:", error);
        toast.error(errorMessage);
      } finally {
        setPending(false);
      }
    }} ref={formRef} id={id} encType={encType} className={className} aria-busy={pending}>
      {children}
    </form>
  );
}
