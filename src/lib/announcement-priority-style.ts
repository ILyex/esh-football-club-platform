const PRIORITY_STYLES = {
  URGENT: {
    card: "border-rose-500/35 bg-rose-500/[0.08]",
    icon: "text-rose-500 dark:text-rose-400",
    row: "border-s-2 border-s-rose-500 bg-rose-500/[0.035]"
  },
  HIGH: {
    card: "border-amber-500/35 bg-amber-500/[0.07]",
    icon: "text-amber-600 dark:text-amber-400",
    row: "border-s-2 border-s-amber-500 bg-amber-500/[0.03]"
  },
  NORMAL: {
    card: "border-sky-500/30 bg-sky-500/[0.045]",
    icon: "text-sky-600 dark:text-sky-400",
    row: "border-s-2 border-s-sky-500 bg-sky-500/[0.02]"
  },
  LOW: {
    card: "border-slate-400/25 bg-slate-500/[0.035]",
    icon: "text-slate-500 dark:text-slate-400",
    row: "border-s-2 border-s-slate-400 bg-slate-500/[0.015]"
  }
} as const;

export function getAnnouncementPriorityStyle(priority: string) {
  return PRIORITY_STYLES[priority as keyof typeof PRIORITY_STYLES] ?? PRIORITY_STYLES.NORMAL;
}
