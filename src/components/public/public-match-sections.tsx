"use client";

import { Children, cloneElement, isValidElement, useState, type HTMLAttributes, type ReactNode } from "react";
import { ListChecks, UsersRound } from "lucide-react";

interface PublicMatchSectionsProps {
  locale: string;
  canViewLineup: boolean;
  showEvents: boolean;
  initialTab?: "events" | "lineup";
  children: ReactNode;
}

type MatchPanelProps = HTMLAttributes<HTMLDivElement> & {
  "data-match-panel"?: "events" | "lineup";
};

export function PublicMatchSections({
  locale,
  canViewLineup,
  showEvents,
  initialTab = "events",
  children
}: PublicMatchSectionsProps) {
  const isAr = locale === "ar";
  const [activeTab, setActiveTab] = useState<"events" | "lineup">(
    canViewLineup && initialTab === "lineup" ? "lineup" : "events"
  );

  if (!canViewLineup && !showEvents) return null;

  const panels = Children.map(children, (child) => {
    if (!isValidElement<MatchPanelProps>(child)) return child;
    const panel = child.props["data-match-panel"];
    if (panel !== "events" && panel !== "lineup") return child;
    return cloneElement(child, {
      id: panel === "events" ? "match-events-panel" : "match-lineup-panel",
      role: "tabpanel",
      "aria-labelledby": panel === "events" ? "match-events-tab" : "match-lineup-tab",
      hidden: activeTab !== panel
    });
  });

  return (
    <section className="space-y-4" aria-label={isAr ? "محتوى المباراة" : "Contenu du match"}>
      <div
        role="tablist"
        aria-label={isAr ? "أقسام المباراة" : "Sections du match"}
        className="flex w-full gap-2 rounded-2xl border border-border/80 bg-card/70 p-1.5 sm:w-fit"
      >
        <button
          type="button"
          role="tab"
          id="match-events-tab"
          aria-controls="match-events-panel"
          aria-selected={activeTab === "events"}
          onClick={() => setActiveTab("events")}
          className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors sm:flex-none ${activeTab === "events" ? "bg-club-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          {isAr ? "أحداث المباراة" : "Événements"}
        </button>
        {canViewLineup && (
          <button
            type="button"
            role="tab"
            id="match-lineup-tab"
            aria-controls="match-lineup-panel"
            aria-selected={activeTab === "lineup"}
            onClick={() => setActiveTab("lineup")}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors sm:flex-none ${activeTab === "lineup" ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <UsersRound className="h-4 w-4" aria-hidden="true" />
            {isAr ? "التشكيلة" : "Composition"}
          </button>
        )}
      </div>

      {panels}
    </section>
  );
}
