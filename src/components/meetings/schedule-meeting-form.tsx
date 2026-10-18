"use client";

import { FormEvent, ReactNode, useState } from "react";

export function ScheduleMeetingForm({
  action,
  children,
  locale,
  serverError
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  locale: string;
  serverError?: "end-before-start" | "invalid-schedule";
}) {
  const [error, setError] = useState(serverError ?? "");

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const values = new FormData(event.currentTarget);
    const start = Date.parse(String(values.get("startDateTime") ?? ""));
    const end = Date.parse(String(values.get("endDateTime") ?? ""));

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      event.preventDefault();
      setError("invalid-schedule");
      return;
    }
    if (end <= start) {
      event.preventDefault();
      setError("end-before-start");
      return;
    }
    setError("");
  }

  const message = error === "end-before-start"
    ? locale === "ar" ? "وقت نهاية الاجتماع يجب أن يكون بعد وقت بدايته." : "L’heure de fin doit être postérieure à l’heure de début."
    : locale === "ar" ? "أدخل تاريخ ووقت البداية والنهاية بشكل صحيح." : "Saisissez une date et des heures de début et de fin valides.";

  return (
    <form action={action} onSubmit={validateBeforeSubmit} className="grid grid-cols-1 gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:grid-cols-2 sm:p-7">
      {error && <p role="alert" className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-700 dark:text-amber-300 sm:col-span-2">{message}</p>}
      {children}
    </form>
  );
}
