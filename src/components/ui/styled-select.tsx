"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };
type SelectTone = "default" | "emerald" | "amber";

export function StyledSelect({
  name,
  defaultValue,
  options,
  className,
  tone = "default"
}: {
  name: string;
  defaultValue: string;
  options: Option[];
  className?: string;
  tone?: SelectTone;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const toneStyles = {
    default: {
      button: "border-border hover:border-club-primary/60 focus:ring-club-primary/25",
      open: "border-club-primary ring-club-primary/20",
      menu: "border-border",
      active: "bg-club-primary/12 text-club-primary"
    },
    emerald: {
      button: "border-emerald-500/50 hover:border-emerald-400 focus:ring-emerald-500/25",
      open: "border-emerald-400 ring-emerald-500/20",
      menu: "border-emerald-500/30",
      active: "bg-emerald-500/15 text-emerald-300"
    },
    amber: {
      button: "border-amber-500/50 hover:border-amber-400 focus:ring-amber-500/25",
      open: "border-amber-400 ring-amber-500/20",
      menu: "border-amber-500/30",
      active: "bg-amber-500/15 text-amber-300"
    }
  }[tone];

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border bg-background px-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2",
          toneStyles.button,
          open && cn("ring-2", toneStyles.open)
        )}
      >
        <span>{selected?.label}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="listbox" className={cn("absolute inset-x-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-lg border bg-card p-1 shadow-xl shadow-black/25", toneStyles.menu)}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={active}
                key={option.value}
                onClick={() => {
                  setValue(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-foreground transition-colors",
                  active ? toneStyles.active : "hover:bg-muted"
                )}
              >
                <span>{option.label}</span>
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
