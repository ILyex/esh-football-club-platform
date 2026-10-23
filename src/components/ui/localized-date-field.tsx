"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

function toDisplayDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

export function LocalizedDateField({
  id,
  name,
  defaultValue = "",
  disabled = false,
  locale = "ar",
  className = "h-11 w-full rounded-xl border border-border bg-background px-3.5 pe-11 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/20 disabled:opacity-60"
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  disabled?: boolean;
  locale?: string;
  className?: string;
}) {
  const [value, setValue] = useState(() => toDisplayDate(defaultValue));
  const pickerRef = useRef<HTMLInputElement>(null);
  const isArabic = locale === "ar";

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type="text"
        dir="ltr"
        inputMode="numeric"
        autoComplete="bday"
        maxLength={10}
        pattern="(?:0[1-9]|[12][0-9]|3[01])/(?:0[1-9]|1[0-2])/[0-9]{4}"
        title={isArabic ? "أدخل التاريخ بصيغة يوم/شهر/سنة" : "Saisissez la date au format jour/mois/année"}
        placeholder="DD/MM/YYYY"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        className={className}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const picker = pickerRef.current;
          if (!picker) return;
          if (typeof picker.showPicker === "function") picker.showPicker();
          else picker.click();
        }}
        aria-label={isArabic ? "اختيار التاريخ" : "Choisir la date"}
        className="absolute inset-y-0 end-1 inline-flex w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={/^\d{2}\/\d{2}\/\d{4}$/.test(value) ? `${value.slice(6, 10)}-${value.slice(3, 5)}-${value.slice(0, 2)}` : ""}
        onChange={(event) => setValue(toDisplayDate(event.target.value))}
        disabled={disabled}
        className="pointer-events-none absolute end-10 top-1/2 h-px w-px -translate-y-1/2 opacity-0"
      />
    </div>
  );
}
