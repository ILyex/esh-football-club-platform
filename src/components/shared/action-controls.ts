import { cn } from "@/lib/utils";

export type ActionControlTone = "edit" | "publish" | "hide" | "delete" | "neutral";

/** Shared visual language for row and toolbar actions across dashboard modules. */
export function actionControlClass(tone: ActionControlTone = "neutral", className?: string) {
  return cn(
    "inline-flex h-8 w-[4.75rem] shrink-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/30 disabled:pointer-events-none disabled:opacity-50",
    tone === "edit" && "border-club-primary/30 bg-club-primary/5 text-club-primary hover:border-club-primary/60 hover:bg-club-primary/10",
    tone === "publish" && "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:border-emerald-500/60 hover:bg-emerald-500/10 dark:text-emerald-400",
    tone === "hide" && "border-amber-500/30 bg-amber-500/5 text-amber-600 hover:border-amber-500/60 hover:bg-amber-500/10 dark:text-amber-400",
    tone === "delete" && "border-red-500/30 bg-red-500/5 text-red-600 hover:border-red-500/60 hover:bg-red-500/10 dark:text-red-400",
    tone === "neutral" && "border-border bg-card text-muted-foreground hover:border-club-primary/40 hover:bg-muted hover:text-foreground",
    className
  );
}
