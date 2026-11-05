"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Trophy,
  FileText,
  Users,
  Target,
  CircleDot,
  ArrowRight,
  ArrowLeft,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type WorkflowStep = {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
  icon?: "trophy" | "file-text" | "users" | "target" | "circle-dot";
  badge?: string;
};

interface MatchWorkflowStepperProps {
  steps: WorkflowStep[];
  locale: string;
  ariaLabel?: string;
  initialStepId?: string;
}

export function MatchWorkflowStepper({
  steps,
  locale,
  ariaLabel,
  initialStepId
}: MatchWorkflowStepperProps) {
  const isAr = locale === "ar";
  const [activeId, setActiveId] = useState<string>(initialStepId || steps[0]?.id || "");
  const [, startTransition] = useTransition();

  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === activeId));
  const totalSteps = steps.length;
  const progressPercent = Math.round(((currentIndex + 1) / totalSteps) * 100);

  // Sync with window.location.hash on mount
  useEffect(() => {
    const hashId = window.location.hash.slice(1);
    const matched = steps.find((s) => s.id === hashId);
    if (matched) {
      setActiveId(matched.id);
    } else if (initialStepId && steps.some((s) => s.id === initialStepId)) {
      setActiveId(initialStepId);
    }
  }, [steps, initialStepId]);

  // Update DOM visibility of sections
  useEffect(() => {
    steps.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) {
        const isActive = id === activeId;
        section.hidden = !isActive;
        section.style.display = isActive ? "" : "none";
        if (section instanceof HTMLDetailsElement) {
          section.open = isActive;
        }
      }
    });
  }, [activeId, steps]);

  const selectStep = (id: string, scroll = false) => {
    startTransition(() => {
      setActiveId(id);
      window.history.replaceState(null, "", `#${id}`);
      if (scroll) {
        const target = document.getElementById(id) || document.getElementById("match-workflow-container");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  };

  const goToNext = () => {
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      if (nextStep) selectStep(nextStep.id, true);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      const prevStep = steps[currentIndex - 1];
      if (prevStep) selectStep(prevStep.id, true);
    }
  };

  const getStepIcon = (iconName?: WorkflowStep["icon"]) => {
    switch (iconName) {
      case "trophy":
        return <Trophy className="h-4 w-4" aria-hidden="true" />;
      case "file-text":
        return <FileText className="h-4 w-4" aria-hidden="true" />;
      case "users":
        return <Users className="h-4 w-4" aria-hidden="true" />;
      case "target":
        return <Target className="h-4 w-4" aria-hidden="true" />;
      case "circle-dot":
        return <CircleDot className="h-4 w-4" aria-hidden="true" />;
      default:
        return <Sparkles className="h-4 w-4" aria-hidden="true" />;
    }
  };

  const currentStep = steps[currentIndex] || steps[0];
  const nextStep = currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null;
  const prevStep = currentIndex > 0 ? steps[currentIndex - 1] : null;

  return (
    <div id="match-workflow-container" className="space-y-4">
      {/* Declarative style injection ensuring non-active steps are hidden without flash */}
      <style>{`
        ${steps
          .filter((s) => s.id !== activeId)
          .map((s) => `#${s.id} { display: none !important; }`)
          .join("\n")}
      `}</style>

      {/* ===================== TOP STEPPER CARD ===================== */}
      <nav
        aria-label={ariaLabel || (isAr ? "مراحل إدارة المباراة" : "Étapes de gestion du match")}
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
      >
        {/* Ambient background glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-club-primary/[0.06] to-transparent"
          aria-hidden="true"
        />

        {/* Stepper Header Bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-club-primary ring-4 ring-club-primary/20" />
              <h2 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                {isAr ? "مسار إدارة المباراة خطوة بخطوة" : "Parcours de gestion du match étape par étape"}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isAr
                ? "أكمل بيانات اللقاء ثم استورد الوثائق واعتمد التشكيلة والأحداث بالترتيب"
                : "Complétez les données, importez les documents et validez la composition et les événements dans l'ordre"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-club-primary/30 bg-club-primary/10 px-3 py-1 font-mono text-xs font-bold text-club-primary">
              {isAr ? `الخطوة ${currentIndex + 1} من ${totalSteps}` : `Étape ${currentIndex + 1} sur ${totalSteps}`}
              <span className="text-[10px] opacity-75">({progressPercent}%)</span>
            </span>
          </div>
        </div>

        {/* Interactive Steps List (Desktop & Tablet) */}
        <div role="tablist" className="relative grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4 xl:gap-3">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const isUpcoming = idx > currentIndex;

            return (
              <button
                key={step.id}
                id={`${step.id}-tab`}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                aria-controls={step.id}
                onClick={() => selectStep(step.id)}
                className={`group relative flex min-w-0 flex-col items-start gap-2 rounded-xl border p-3 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary ${
                  isCurrent
                    ? "border-club-primary/60 bg-club-primary/10 shadow-sm ring-1 ring-club-primary/30"
                    : isCompleted
                      ? "border-border/80 bg-background/60 hover:border-club-primary/40 hover:bg-muted/40"
                      : "border-border/50 bg-background/30 text-muted-foreground hover:border-border hover:bg-muted/20"
                }`}
              >
                {/* Step indicator header */}
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black transition-all ${
                        isCurrent
                          ? "bg-club-primary text-white shadow-sm ring-2 ring-club-primary/40"
                          : isCompleted
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground group-hover:text-foreground"
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : idx + 1}
                    </span>
                    <span
                      className={`shrink-0 transition-colors ${
                        isCurrent ? "text-club-primary" : isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      }`}
                    >
                      {getStepIcon(step.icon)}
                    </span>
                  </div>

                  {isCurrent && (
                    <span className="inline-flex rounded-full bg-club-primary/20 px-2 py-0.5 text-[10px] font-bold text-club-primary">
                      {isAr ? "الحالية" : "Active"}
                    </span>
                  )}
                  {isCompleted && (
                    <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {isAr ? "تمت" : "Fait"}
                    </span>
                  )}
                </div>

                {/* Step labels */}
                <div className="min-w-0">
                  <p
                    className={`truncate text-xs font-bold sm:text-sm ${
                      isCurrent
                        ? "text-foreground"
                        : isCompleted
                          ? "text-foreground/90"
                          : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{step.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Global Progress Track Line */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-club-primary to-emerald-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </nav>

      {/* ===================== FLOATING / BOTTOM STEP NAVIGATION BAR ===================== */}
      {/* This persistent bar lets the admin navigate comfortably from any step */}
      <div className="sticky bottom-4 z-20 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-2xl border border-border/90 bg-card/95 p-3 shadow-lg backdrop-blur-md">
        {/* Previous Button */}
        <div>
          {prevStep ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goToPrev}
              className="h-9 gap-1.5 rounded-xl border-border px-3 text-xs font-bold hover:border-club-primary/50 hover:bg-club-primary/5 hover:text-club-primary"
            >
              {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              <span>{isAr ? `السابق: ${prevStep.shortLabel || prevStep.label}` : `Précédent : ${prevStep.shortLabel || prevStep.label}`}</span>
            </Button>
          ) : (
            <span className="text-xs font-medium text-muted-foreground px-2">
              {isAr ? "بداية المسار" : "Début du parcours"}
            </span>
          )}
        </div>

        {/* Current Step Counter Badge */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span>
            {isAr
              ? `الخطوة ${currentIndex + 1} من ${totalSteps} : `
              : `Étape ${currentIndex + 1} sur ${totalSteps} : `}
          </span>
          <span className="font-bold text-foreground">{currentStep?.label}</span>
        </div>

        {/* Next Button */}
        <div>
          {nextStep ? (
            <Button
              type="button"
              size="sm"
              onClick={goToNext}
              className="h-9 gap-1.5 rounded-xl bg-club-primary px-4 text-xs font-bold text-white shadow-sm hover:bg-club-primary-hover"
            >
              <span>{isAr ? `التالي: ${nextStep.shortLabel || nextStep.label}` : `Suivant : ${nextStep.shortLabel || nextStep.label}`}</span>
              {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectStep(steps[0]?.id || "", true)}
              className="h-9 gap-1.5 rounded-xl border-emerald-500/40 bg-emerald-500/10 px-3.5 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
            >
              <Check className="h-4 w-4" />
              <span>{isAr ? "تمت مراجعة جميع الخطوات" : "Toutes les étapes vérifiées"}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
