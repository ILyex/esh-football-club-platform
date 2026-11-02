"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFixedPopover } from "@/hooks/use-fixed-popover";

interface FormSelectProps {
  id?: string;
  name: string;
  options: Array<{ value: string; label: string; warning?: string; disabled?: boolean }>;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  locale?: string;
  placeholder?: string;
  ariaLabel?: string;
  triggerClassName?: string;
  compact?: boolean;
  onValueChange?: (value: string) => void;
}

export function FormSelect({
  id,
  name,
  options,
  value,
  defaultValue = "",
  required = false,
  disabled = false,
  locale = "ar",
  placeholder = "—",
  ariaLabel,
  triggerClassName,
  compact = false,
  onValueChange
}: FormSelectProps) {
  const isAr = locale === "ar";
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue);
  // Portal + fixed coordinates: the list must not be clipped by a card/scroll
  // container, and must never cover the field it was opened from.
  const popover = useFixedPopover(open, rootRef, panelRef, 256);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (value === undefined) setInternalValue(defaultValue);
  }, [defaultValue, value]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
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
      <input type="hidden" name={name} value={selectedValue} />
      <button
        id={id}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-label={ariaLabel}
        aria-required={required}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className={cn("flex w-full items-center justify-between rounded-lg border border-border bg-background text-start text-foreground outline-none transition-colors hover:border-club-primary/50 focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20 disabled:cursor-not-allowed disabled:opacity-60", compact ? "min-h-8 gap-2 px-2.5 py-1 text-[11px] shadow-none" : "min-h-10 gap-3 px-3 py-2 text-sm shadow-2xs", triggerClassName)}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("shrink-0 text-muted-foreground transition-transform", compact ? "h-3.5 w-3.5" : "h-4 w-4", open && "rotate-180 text-club-primary")} />
      </button>
      {selected?.warning && (
        <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-4 text-amber-700 dark:text-amber-300" role="status">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{selected.warning}</span>
        </p>
      )}
      {open && !disabled && mounted && createPortal(
        <div
          ref={panelRef}
          id={menuId}
          role="listbox"
          dir={isAr ? "rtl" : "ltr"}
          aria-label={ariaLabel ?? (isAr ? "الخيارات" : "Options")}
          style={popover.style}
          className={cn("overflow-y-auto overscroll-contain rounded-xl border border-border bg-card text-foreground shadow-xl ring-1 ring-black/5", compact ? "p-1" : "p-1.5")}
        >
          {options.map((option) => {
            const isSelected = selectedValue === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onClick={() => {
                  if (value === undefined) setInternalValue(option.value);
                  setOpen(false);
                  onValueChange?.(option.value);
                }}
                className={cn("flex w-full items-center justify-between rounded-lg text-start font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45", compact ? "min-h-8 gap-1.5 px-2 py-1 text-[11px]" : "min-h-10 gap-2 px-2.5 py-2 text-xs", isSelected ? "bg-club-primary/10 font-bold text-club-primary" : "text-foreground hover:bg-muted")}
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  <span className="truncate">{option.label}</span>
                  {option.warning && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label={option.warning} />}
                </span>
                {isSelected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
