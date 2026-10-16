"use client";

import { useState, type FormEvent, type ReactNode } from "react";

// Vercel Functions cap the entire request body at 4.5 MB. Leave room for the
// multipart/form-data envelope and the rest of the form fields.
export const MAX_MEDICAL_UPLOAD_BYTES = 3.5 * 1024 * 1024;

export function MedicalUploadForm({
  action,
  children,
  isArabic
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  isArabic: boolean;
}) {
  const [error, setError] = useState("");

  function validateFile(event: FormEvent<HTMLFormElement>) {
    const input = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
    const file = input?.files?.[0];
    if (file && file.size > MAX_MEDICAL_UPLOAD_BYTES) {
      event.preventDefault();
      setError(isArabic
        ? "حجم الوثيقة أكبر من الحد الحالي (3.5 ميغابايت). قلّل حجم الصورة أو امسحها بدقة أقل ثم أعد المحاولة."
        : "Le document dépasse la limite actuelle (3,5 Mo). Réduisez la taille ou la résolution du scan puis réessayez.");
      input?.focus();
      return;
    }
    setError("");
  }

  return (
    <form id="medical-document-form" action={action} encType="multipart/form-data" onSubmit={validateFile} className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5">
      {error && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300">{error}</p>}
      {children}
    </form>
  );
}
