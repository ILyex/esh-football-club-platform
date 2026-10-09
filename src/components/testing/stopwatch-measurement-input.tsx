"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

export function StopwatchMeasurementInput({
  value,
  onChange,
  locale,
  disabled = false
}: {
  value: string | number | undefined;
  onChange: (value: string) => void;
  locale: string;
  disabled?: boolean;
}) {
  const isAr = locale === "ar";
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (startAtRef.current !== null) setElapsedMs(performance.now() - startAtRef.current);
    }, 25);
    return () => window.clearInterval(timer);
  }, [running]);

  const displayedTime = running
    ? (elapsedMs / 1000).toFixed(2)
    : value === undefined || value === ""
    ? ""
    : Number(value).toFixed(2);

  function toggleTimer() {
    if (running) {
      const finalMs = startAtRef.current === null ? elapsedMs : performance.now() - startAtRef.current;
      setElapsedMs(finalMs);
      startAtRef.current = null;
      setRunning(false);
      onChange((finalMs / 1000).toFixed(2));
      return;
    }
    const previousMs = Number(value) > 0 ? Number(value) * 1000 : elapsedMs;
    startAtRef.current = performance.now() - previousMs;
    setElapsedMs(previousMs);
    setRunning(true);
  }

  function resetTimer() {
    startAtRef.current = null;
    setElapsedMs(0);
    setRunning(false);
    onChange("");
  }

  return (
    <div className="inline-flex items-center gap-1" dir="ltr">
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        placeholder="0.00"
        value={displayedTime}
        disabled={disabled || running}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-[4.5rem] rounded-lg border border-border bg-background px-2 text-center text-xs font-mono tabular-nums text-foreground outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:opacity-70 print:hidden"
        aria-label={isAr ? "الوقت بالثواني" : "Temps en secondes"}
      />
      <button
        type="button"
        onClick={toggleTimer}
        disabled={disabled}
        aria-label={running ? (isAr ? "إيقاف المؤقت" : "Arrêter le chronomètre") : (isAr ? "بدء المؤقت" : "Démarrer le chronomètre")}
        title={running ? (isAr ? "إيقاف" : "Arrêter") : (isAr ? "ابدأ التوقيت" : "Démarrer le chronomètre")}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors print:hidden ${running ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"}`}
      >
        {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={resetTimer}
        disabled={disabled || (!running && !Number(value) && !elapsedMs)}
        aria-label={isAr ? "إعادة ضبط الوقت" : "Réinitialiser le temps"}
        title={isAr ? "إعادة ضبط" : "Réinitialiser"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 print:hidden"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
      <span className="hidden print:inline font-mono text-xs tabular-nums">{displayedTime || "—"}</span>
    </div>
  );
}
