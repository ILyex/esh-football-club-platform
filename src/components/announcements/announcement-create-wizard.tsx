"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnnouncementCreateWizardProps {
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  steps: ReactNode[];
  stepTitles: string[];
  backLabel: string;
  nextLabel: string;
  saveLabel: string;
}

export function AnnouncementCreateWizard({
  action,
  locale,
  steps,
  stepTitles,
  backLabel,
  nextLabel,
  saveLabel
}: AnnouncementCreateWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const isRtl = locale === "ar";
  const PreviousIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  function findInvalidControl(stepIndex: number) {
    const step = formRef.current?.querySelector<HTMLElement>(`[data-announcement-step="${stepIndex}"]`);
    return Array.from(step?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select") ?? [])
      .find((control) => control.willValidate && !control.checkValidity()) ?? null;
  }

  function validateStep(stepIndex: number) {
    const invalidControl = findInvalidControl(stepIndex);
    if (invalidControl) {
      invalidControl.reportValidity();
      invalidControl.focus();
      return false;
    }
    return true;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    for (let index = 0; index < steps.length; index += 1) {
      const invalidControl = findInvalidControl(index);
      if (!invalidControl) continue;
      event.preventDefault();
      setActiveStep(index);
      requestAnimationFrame(() => {
        invalidControl.reportValidity();
        invalidControl.focus();
      });
      return;
    }
  }

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit} noValidate encType="multipart/form-data" className="space-y-4 pb-20 sm:pb-0">
      <ol aria-label={isRtl ? "خطوات إنشاء الإعلان" : "Étapes de création de l’annonce"} className="grid grid-cols-3 gap-2">
        {stepTitles.map((title, index) => {
          const complete = index < activeStep;
          const current = index === activeStep;
          return (
            <li key={title} aria-current={current ? "step" : undefined} className={`flex min-h-12 min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] font-semibold sm:px-3 sm:text-xs ${current ? "border-club-primary/40 bg-club-primary/10 text-club-primary" : complete ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300" : "border-border bg-card text-muted-foreground"}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${current ? "bg-club-primary text-white" : complete ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
                {complete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0 truncate">{title}</span>
            </li>
          );
        })}
      </ol>

      {steps.map((content, index) => (
        <div key={index} data-announcement-step={index} hidden={index !== activeStep}>
          {content}
        </div>
      ))}

      <div className="sticky bottom-2 z-20 -mx-2 flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:static sm:mx-0 sm:border-t sm:border-x-0 sm:border-b-0 sm:rounded-none sm:bg-transparent sm:p-0 sm:pt-4 sm:shadow-none sm:backdrop-blur-none">
        {activeStep > 0 ? (
          <Button type="button" variant="outline" className="min-h-11 gap-2 rounded-xl px-4" onClick={() => setActiveStep((step) => Math.max(0, step - 1))}>
            <PreviousIcon className="h-4 w-4" aria-hidden="true" />
            <span>{backLabel}</span>
          </Button>
        ) : <span />}

        {activeStep < steps.length - 1 ? (
          <Button type="button" className="min-h-11 gap-2 rounded-xl px-5" onClick={() => {
            if (validateStep(activeStep)) setActiveStep((step) => Math.min(steps.length - 1, step + 1));
          }}>
            <span>{nextLabel}</span>
            <NextIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="submit" className="min-h-11 gap-2 rounded-xl px-5 font-semibold">
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{saveLabel}</span>
          </Button>
        )}
      </div>
    </form>
  );
}
