"use client";

import { useMemo } from "react";

export interface TeamCategoryChartProps {
  playersByPosition: {
    position: string;
    count: number;
  }[];
  totalPlayers: number;
  locale?: string;
}

const DEFAULT_STYLE = { bg: "bg-muted", text: "text-muted-foreground", bar: "bg-primary" };

const POSITION_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  GOALKEEPER: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  DEFENDER: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", bar: "bg-blue-500" },
  MIDFIELDER: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  FORWARD: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500" }
};

const POSITION_NAMES_AR: Record<string, string> = {
  GOALKEEPER: "حراسة المرمى",
  DEFENDER: "خط الدفاع",
  MIDFIELDER: "وسط الميدان",
  FORWARD: "خط الهجوم"
};

const POSITION_NAMES_FR: Record<string, string> = {
  GOALKEEPER: "Gardiens",
  DEFENDER: "Défenseurs",
  MIDFIELDER: "Milieux",
  FORWARD: "Attaquants"
};

export function TeamCategoryChart({
  playersByPosition,
  totalPlayers,
  locale = "ar"
}: TeamCategoryChartProps) {
  const isAr = locale === "ar";

  const chartData = useMemo(() => {
    const order = ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"];
    return order.map((pos) => {
      const match = playersByPosition.find((p) => p.position === pos);
      const count = match ? match.count : 0;
      const pct = totalPlayers > 0 ? Math.round((count / totalPlayers) * 100) : 0;
      return {
        key: pos,
        name: isAr ? POSITION_NAMES_AR[pos] : POSITION_NAMES_FR[pos],
        shortName:
          pos === "GOALKEEPER"
            ? isAr ? "حارس" : "GK"
            : pos === "DEFENDER"
            ? isAr ? "دفاع" : "DEF"
            : pos === "MIDFIELDER"
            ? isAr ? "وسط" : "MID"
            : isAr ? "هجوم" : "FWD",
        count,
        pct,
        style: POSITION_COLORS[pos] || DEFAULT_STYLE
      };
    });
  }, [playersByPosition, totalPlayers, isAr]);

  if (totalPlayers === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 text-xs text-muted-foreground">
        <span>{isAr ? "لا يوجد لاعبون مسجلون في هذه الفئة حالياً" : "Aucun joueur enregistré"}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Title & Total Players */}
      <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-club-primary animate-pulse" />
          <span>{isAr ? "التوزيع التكتيكي للتشكيلة" : "Répartition tactique"}</span>
        </span>
        <span className="font-mono text-foreground font-black text-xs">
          {totalPlayers} {isAr ? "لاعباً" : "joueurs"}
        </span>
      </div>

      {/* Proportional Segmented Track (Simple Horizontal Chart) */}
      <div
        dir="ltr"
        className="h-3 w-full overflow-hidden rounded-full bg-muted/60 flex p-0.5 border border-border/50 gap-0.5 shadow-2xs"
      >
        {chartData.map((item) => {
          if (item.count === 0) return null;
          return (
            <div
              key={item.key}
              style={{ width: `${item.pct}%` }}
              className={`h-full rounded-xs ${item.style.bar} transition-all duration-300 relative group cursor-pointer`}
              title={`${item.name}: ${item.count} (${item.pct}%)`}
            />
          );
        })}
      </div>

      {/* Modern Compact Position Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
        {chartData.map((item) => (
          <div
            key={item.key}
            className={`flex flex-col justify-between p-2 rounded-xl border border-border/50 bg-card/60 transition-colors hover:bg-card`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-muted-foreground truncate">{item.name}</span>
              <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md ${item.style.bg} ${item.style.text}`}>
                {item.pct}%
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${item.style.bar}`} />
                <span className="font-mono text-sm font-black text-foreground">{item.count}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{isAr ? "لاعب" : "jrs"}</span>
            </div>

            {/* Position Mini-meter */}
            <div dir="ltr" className="h-1 w-full rounded-full bg-muted mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${item.style.bar}`}
                style={{ width: `${item.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
