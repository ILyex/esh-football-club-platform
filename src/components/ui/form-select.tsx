"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormSelectProps {
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  locale?: string;
  placeholder?: string;
  ariaLabel?: string;
  onValueChange?: (value: string) => void;
}

export function FormSelect({
  name,
  options,
  defaultValue = "",
  required = false,
  disabled = false,
  locale = "ar",
  placeholder = "—",
  ariaLabel,
  onValueChange
}: FormSelectProps) {
  const isAr = locale === "ar";
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative w-full" dir={isAr ? "rtl" : "ltr"}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        disabled={disabled}
        role="combobox"
        aria-label={ariaLabel}
        aria-required={required}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-start text-sm text-foreground shadow-2xs outline-none transition-colors hover:border-club-primary/50 focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180 text-club-primary")} />
      </button>
      {open && !disabled && (
        <div id={menuId} role="listbox" aria-label={ariaLabel ?? (isAr ? "الخيارات" : "Options")} className="absolute start-0 top-[calc(100%+0.375rem)] z-[70] max-h-64 w-full min-w-48 overflow-y-auto rounded-xl border border-border bg-card p-1.5 text-foreground shadow-xl ring-1 ring-black/5">
          {options.map((option) => {
            const isSelected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setValue(option.value);
                  setOpen(false);
                  onValueChange?.(option.value);
                }}
                className={cn("flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-xs font-medium transition-colors", isSelected ? "bg-club-primary/10 font-bold text-club-primary" : "text-foreground hover:bg-muted")}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
