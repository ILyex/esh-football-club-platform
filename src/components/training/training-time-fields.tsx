"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { TimeInput } from "@/components/ui/time-input";

interface TrainingTimeFieldsProps {
  locale: string;
  startLabel: string;
  endLabel: string;
  startName?: string;
  endName?: string;
  defaultStart?: string;
  defaultEnd?: string;
  disabled?: boolean;
  required?: boolean;
}

export function TrainingTimeFields({
  locale,
  startLabel,
  endLabel,
  startName = "startTime",
  endName = "endTime",
  defaultStart = "",
  defaultEnd = "",
  disabled = false,
  required = true
}: TrainingTimeFieldsProps) {
  const isAr = locale === "ar";
  const rootRef = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  useEffect(() => {
    setStart(defaultStart);
    setEnd(defaultEnd);
  }, [defaultStart, defaultEnd]);
  const invalid = Boolean(start && end && end <= start);
  const message = isAr
    ? "يجب أن يكون وقت البداية قبل وقت النهاية."
    : "L’heure de début doit être avant l’heure de fin.";

  useEffect(() => {
    const endInput = Array.from(rootRef.current?.querySelectorAll<HTMLInputElement>("input") ?? [])
      .find((input) => input.name === endName);
    if (!endInput) return;
    endInput.setCustomValidity(invalid ? message : "");
    return () => endInput.setCustomValidity("");
  }, [endName, invalid, message]);

  return (
    <div ref={rootRef} className="col-span-1 grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
      <div>
        <label className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Clock3 className="h-4 w-4 text-club-primary" aria-hidden="true" />
          {startLabel}
        </label>
        <TimeInput name={startName} value={start} required={required} disabled={disabled} locale={locale} onChange={setStart} />
      </div>
      <div>
        <label className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Clock3 className="h-4 w-4 text-club-primary" aria-hidden="true" />
          {endLabel}
        </label>
        <TimeInput name={endName} value={end} required={required} disabled={disabled} locale={locale} onChange={setEnd} />
      </div>
      {invalid && (
        <p className="-mt-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive sm:col-span-2" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
