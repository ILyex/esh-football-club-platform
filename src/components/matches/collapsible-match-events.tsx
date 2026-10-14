"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function CollapsibleMatchEvents({
  children,
  defaultCollapsed,
  label,
  showLabel,
  hideLabel
}: {
  children: ReactNode;
  defaultCollapsed: boolean;
  label: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const Icon = collapsed ? ChevronDown : ChevronUp;

  return (
    <section className="mt-3 border-t border-border/70 pt-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((current) => !current)}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[10px] font-semibold text-muted-foreground transition hover:border-club-primary/40 hover:text-foreground"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {collapsed ? showLabel : hideLabel}
        </button>
      </div>
      {!collapsed && <div className="mt-2 space-y-2">{children}</div>}
    </section>
  );
}
