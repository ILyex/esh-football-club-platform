"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFixedPopover } from "@/hooks/use-fixed-popover";

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
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  // Fixed-position panel rendered in a portal: an ancestor with overflow hidden
  // used to clip the list and paint it over the field itself.
  const popover = useFixedPopover(open, ref, panelRef, 320);
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

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
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
        <span className="truncate">{selected?.label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && mounted && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          style={popover.style}
          className={cn("overflow-y-auto overscroll-contain rounded-lg border bg-card p-1 shadow-xl shadow-black/25", toneStyles.menu)}
        >
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
                  "flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors",
                  active ? toneStyles.active : "hover:bg-muted"
                )}
              >
                <span className="truncate">{option.label}</span>
                {active && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
