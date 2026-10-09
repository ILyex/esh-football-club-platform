"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Clock3, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TrainingOption {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  teamName: string;
}

export function TrainingAttendancePicker({
  sessions,
  locale,
  triggerLabel
}: {
  sessions: TrainingOption[];
  locale: string;
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const isAr = locale === "ar";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-300 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
      >
        <ClipboardCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        {triggerLabel}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="training-attendance-picker-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-border/70 pb-4">
              <div>
                <h2 id="training-attendance-picker-title" className="text-base font-bold text-foreground">
                  {isAr ? "اختر الحصة لتسجيل الحضور" : "Choisir une séance pour l’appel"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isAr ? "اختر حصة مبرمجة لفتح كشف الحضور مباشرة." : "Sélectionnez une séance programmée pour ouvrir sa feuille de présence."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={isAr ? "إغلاق" : "Fermer"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {sessions.length ? (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/${locale}/dashboard/training/${session.id}?view=attendance`}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-foreground">{session.teamName}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-FR", { dateStyle: "medium" }).format(new Date(session.date))}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground" dir="ltr">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      {session.startTime}–{session.endTime}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {isAr ? "لا توجد حصص مبرمجة حاليًا." : "Aucune séance programmée pour le moment."}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
