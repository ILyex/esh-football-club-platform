"use client";

import { useEffect, useState } from "react";

type Tab = { id: string; label: string };

export function MatchManagementTabs({ tabs, ariaLabel }: { tabs: Tab[]; ariaLabel: string }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const hashId = window.location.hash.slice(1);
    const initialId = tabs.some((tab) => tab.id === hashId) ? hashId : tabs[0]?.id;
    if (initialId) setActiveId(initialId);
  }, [tabs]);

  useEffect(() => {
    tabs.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) {
        section.hidden = id !== activeId;
        if (id === "match-documents" && id === activeId && section instanceof HTMLDetailsElement) {
          section.open = true;
        }
      }
    });
  }, [activeId, tabs]);

  const selectTab = (id: string) => {
    setActiveId(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav aria-label={ariaLabel} role="tablist" className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-3">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          id={`${id}-tab`}
          type="button"
          role="tab"
          aria-selected={activeId === id}
          aria-controls={id}
          onClick={() => selectTab(id)}
          className={`inline-flex min-h-9 items-center rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${activeId === id ? "border-club-primary/50 bg-club-primary/10 text-club-primary" : "border-border bg-background text-muted-foreground hover:border-club-primary/40 hover:bg-club-primary/5 hover:text-club-primary"}`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
