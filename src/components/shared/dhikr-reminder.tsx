"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const DHIKR = [
  { ar: "اللهم صلِّ وسلم على نبينا محمد", fr: "Que la paix et les bénédictions soient sur le Prophète Mohammed." },
  { ar: "سبحان الله وبحمده", fr: "Gloire et louange à Allah." },
  { ar: "الحمد لله", fr: "Louange à Allah." },
  { ar: "أستغفر الله وأتوب إليه", fr: "Je demande pardon à Allah et je me repens auprès de Lui." },
  { ar: "لا إله إلا الله", fr: "Il n’y a de divinité qu’Allah." },
  { ar: "سبحان الله العظيم", fr: "Gloire à Allah, le Très-Grand." },
  { ar: "الله أكبر", fr: "Allah est le plus Grand." },
  { ar: "لا حول ولا قوة إلا بالله", fr: "Il n’y a de force ni de puissance qu’en Allah." }
] as const;

const INTERVAL_MS = 3 * 60 * 1_000;
const DISPLAY_MS = 20 * 1_000;

export function DhikrReminder({ locale }: { locale: string }) {
  const isAr = locale === "ar";
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    let showTimer: number | undefined;
    let dismissTimer: number | undefined;
    let index = 0;

    const clearTimers = () => {
      if (showTimer !== undefined) window.clearTimeout(showTimer);
      if (dismissTimer !== undefined) window.clearTimeout(dismissTimer);
    };

    const schedule = (delayMs = INTERVAL_MS) => {
      if (document.hidden) return;
      showTimer = window.setTimeout(() => {
        if (document.hidden) {
          schedule();
          return;
        }
        setActiveIndex(index % DHIKR.length);
        index += 1;
        dismissTimer = window.setTimeout(() => {
          setActiveIndex(null);
          // Keep reminder appearances on a three-minute cadence, including
          // the time the current message stays visible.
          schedule(Math.max(0, INTERVAL_MS - DISPLAY_MS));
        }, DISPLAY_MS);
      }, delayMs);
    };

    const onVisibilityChange = () => {
      clearTimers();
      setActiveIndex(null);
      if (!document.hidden) schedule();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimers();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const dhikr = activeIndex === null ? null : DHIKR[activeIndex];
  return <div className={`pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] z-[90] w-[calc(100vw-1.5rem)] max-w-[360px] transition-all duration-500 sm:bottom-6 ${isAr ? "right-3 sm:right-6" : "left-3 sm:left-6"} ${dhikr ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`} aria-live="polite" aria-atomic="true">
    {dhikr && <div dir={isAr ? "rtl" : "ltr"} className="pointer-events-auto relative overflow-hidden rounded-2xl border border-club-primary/25 bg-card/80 p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)] backdrop-blur-xl sm:p-5">
      <div className="absolute inset-y-0 start-0 w-1 bg-club-primary" />
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary"><Sparkles className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1 text-start">
          <p className="text-[10px] font-bold tracking-wide text-club-primary">{isAr ? "أذكار المسلم" : "Rappel de dhikr"}</p>
          <p className="mt-1.5 text-base font-bold leading-relaxed text-foreground sm:text-lg">{dhikr.ar}</p>
          {!isAr && <p lang="fr" className="mt-1 text-xs leading-relaxed text-muted-foreground">{dhikr.fr}</p>}
        </div>
      </div>
    </div>}
  </div>;
}
