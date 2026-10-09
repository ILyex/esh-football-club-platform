"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { popoverPlacementStyle, useAutoPopoverPlacement } from "@/hooks/use-auto-popover-placement";

interface TimeInputProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  locale?: string;
  className?: string;
  id?: string;
}

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function isValidTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return !!match && Number(match[1]) < 24 && Number(match[2]) < 60;
}

export function TimeInput({
  name,
  value,
  defaultValue = "",
  onChange,
  required = false,
  disabled = false,
  locale = "ar",
  className,
  id
}: TimeInputProps) {
  const isAr = locale === "ar";
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const [draft, setDraft] = useState(value ?? defaultValue);
  const [open, setOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState<"hour" | "minute">("hour");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentValue = value ?? internalValue;
  const [hour = "00", minute = "00"] = currentValue.split(":");
  const placement = useAutoPopoverPlacement(open, rootRef, panelRef, 360);

  useEffect(() => {
    if (value !== undefined || defaultValue !== undefined) {
      const nextValue = value ?? defaultValue;
      setInternalValue(nextValue);
      setDraft(nextValue);
    }
  }, [value, defaultValue]);

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

  const commit = (nextValue: string) => {
    setInternalValue(nextValue);
    setDraft(nextValue);
    onChange?.(nextValue);
  };

  const selectPart = (part: "hour" | "minute", next: string) => {
    const nextHour = part === "hour" ? next : hour;
    const nextMinute = part === "minute" ? next : minute;
    commit(`${nextHour}:${nextMinute}`);
    if (part === "hour") {
      setActiveColumn("minute");
    } else {
      setOpen(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className={cn("relative w-full min-w-28", className)} dir="ltr">
      <div className="flex h-10 overflow-hidden rounded-xl border border-border bg-background shadow-2xs transition-colors focus-within:border-club-primary focus-within:ring-1 focus-within:ring-club-primary">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="HH:MM"
          value={draft}
          required={required}
          disabled={disabled}
          aria-label={isAr ? "الوقت" : "Heure"}
          aria-haspopup="listbox"
          aria-controls={`${id ?? name ?? "time"}-options`}
          pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            const next = event.target.value.slice(0, 5);
            setDraft(next);
            if (isValidTime(next)) commit(next);
          }}
          onBlur={() => {
            if (!isValidTime(draft)) setDraft(currentValue);
          }}
          className="h-full min-w-0 flex-1 rounded-l-xl bg-transparent px-2.5 pe-1 font-mono text-sm tabular-nums text-foreground outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={isAr ? "اختيار الساعة والدقيقة" : "Choisir l’heure et les minutes"}
          aria-expanded={open}
          onClick={() => {
            setActiveColumn("hour");
            setOpen((isOpen) => !isOpen);
          }}
          className="flex h-full w-8 shrink-0 items-center justify-center border-l border-border/70 bg-transparent text-muted-foreground transition-colors hover:bg-transparent hover:text-club-primary active:bg-transparent disabled:opacity-50"
        >
          <Clock className="h-4 w-4" />
        </button>
      </div>

      {open && !disabled && (
        <div ref={panelRef} id={`${id ?? name ?? "time"}-options`} style={popoverPlacementStyle(placement, "0.375rem")} className="absolute start-0 z-[90] w-[min(14rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-2 text-foreground shadow-xl ring-1 ring-black/5" role="group" aria-label={isAr ? "اختيار الوقت" : "Sélection de l’heure"}>
          <div className="grid grid-cols-2 gap-2">
            {(["hour", "minute"] as const).map((part) => {
              const options = part === "hour" ? hours : minutes;
              const selected = part === "hour" ? hour : minute;
              const title = part === "hour" ? (isAr ? "الساعة" : "Heures") : (isAr ? "الدقائق" : "Minutes");
              return (
                <div key={part}>
                  <button
                    type="button"
                    onClick={() => setActiveColumn(part)}
                      className={cn("mb-1 min-h-9 w-full rounded-md px-2 py-1 text-[10px] font-semibold", activeColumn === part ? "bg-club-primary/10 text-club-primary" : "text-muted-foreground hover:bg-muted")}
                  >
                    {title}
                  </button>
                  <div role="listbox" aria-label={title} className="max-h-48 overflow-y-auto overscroll-contain rounded-lg border border-border/70 bg-background p-1 [scrollbar-width:thin]">
                    {options.map((option) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected === option}
                        key={option}
                        onClick={() => selectPart(part, option)}
                        className={cn("my-0.5 min-h-10 w-full rounded-md px-2 text-sm font-mono tabular-nums transition-colors", selected === option ? "bg-club-primary text-white" : "text-foreground hover:bg-muted")}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
