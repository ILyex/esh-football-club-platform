"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const PALETTE = [
  "#B31B1B", // Club Primary Red
  "#0F172A", // Dark Slate
  "#059669", // Emerald Green
  "#D97706", // Amber Orange
  "#2563EB", // Royal Blue
  "#7C3AED", // Violet
  "#0891B2", // Cyan
  "#475569"  // Slate Grey
];

interface ChartItem {
  label: string;
  value: number;
}

interface ReportBarChartProps {
  data: ChartItem[];
  color?: string;
  horizontal?: boolean;
  locale?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

function ModernChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="rounded-xl border border-border/80 bg-popover/95 px-3 py-2 text-popover-foreground shadow-lg backdrop-blur-md">
        <p className="text-xs font-semibold text-muted-foreground mb-1">{label || item.name}</p>
        <p className="text-sm font-black [font-family:Arial,sans-serif] text-foreground flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full inline-block"
            style={{ backgroundColor: item.color || item.fill || "#B31B1B" }}
          />
          <span>{item.value}</span>
        </p>
      </div>
    );
  }
  return null;
}

export function ReportBarChart({
  data,
  color = "#B31B1B",
  horizontal = false,
  locale = "ar"
}: ReportBarChartProps) {
  const isAr = locale === "ar";
  // Long localized labels collide in narrow cards even with only a few values.
  // Give them a horizontal layout and keep the full label available in tooltip.
  const useHorizontalLayout = horizontal || (data?.length ?? 0) > 3 ||
    (data ?? []).some((item) => Array.from(item.label).length > (isAr ? 10 : 14));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-56 w-full items-center justify-center rounded-xl bg-muted/20 animate-pulse">
        <span className="text-xs text-muted-foreground font-medium">{isAr ? "جارٍ تحميل المخطط..." : "Chargement du graphique..."}</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/10">
        <span className="text-xs text-muted-foreground">{isAr ? "لا توجد بيانات متاحة لعرض المخطط" : "Aucune donnée à afficher"}</span>
      </div>
    );
  }

  if (useHorizontalLayout) {
    const maxValue = Math.max(...data.map((item) => item.value), 1);
    return (
      <div className="w-full min-w-0 space-y-4 px-1 py-3" dir={isAr ? "rtl" : "ltr"}>
        {data.map((item, index) => {
          const barColor = PALETTE[index % PALETTE.length] || color;
          const percentage = Math.max(0, Math.min(100, (item.value / maxValue) * 100));
          return (
            <div key={`${item.label}-${index}`} className="min-w-0 space-y-1.5" title={`${item.label}: ${item.value}`}>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <span dir="auto" className="min-w-0 flex-1 break-words text-start text-xs font-medium leading-5 text-foreground">
                  {item.label}
                </span>
                <span dir="ltr" className="shrink-0 rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-xs font-bold tabular-nums text-foreground">
                  {item.value.toLocaleString(locale)}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={item.label}
                aria-valuemin={0}
                aria-valuemax={maxValue}
                aria-valuenow={item.value}
                className="h-2.5 w-full overflow-hidden rounded-full bg-muted/80"
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${percentage}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 h-72 pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barCategoryGap="25%"
          margin={{ top: 10, right: 12, left: 0, bottom: 38 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
          <XAxis
            dataKey="label"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-25}
            textAnchor="end"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            className="text-muted-foreground font-medium"
          />
          <YAxis
            allowDecimals={false}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            className="text-muted-foreground font-bold [font-family:Arial,sans-serif]"
          />
          <Tooltip content={<ModernChartTooltip />} cursor={{ fill: "rgba(0, 0, 0, 0.04)" }} />
          <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={24}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportPieChart({ data, locale = "ar" }: { data: ChartItem[]; locale?: string }) {
  const isAr = locale === "ar";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-xl bg-muted/20 animate-pulse">
        <span className="text-xs text-muted-foreground font-medium">{isAr ? "جارٍ تحميل المخطط..." : "Chargement du graphique..."}</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/10">
        <span className="text-xs text-muted-foreground">{isAr ? "لا توجد بيانات متاحة لعرض المخطط" : "Aucune donnée à afficher"}</span>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full h-64">
      <div className="relative w-44 h-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={75}
              paddingAngle={3}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="var(--card)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<ModernChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center Total Count */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-black [font-family:Arial,sans-serif] text-foreground leading-none">
            {total}
          </span>
          <span className="text-[10px] text-muted-foreground font-bold mt-1">{isAr ? "الإجمالي" : "Total"}</span>
        </div>
      </div>

      {/* Legend Badges */}
      <div className="flex flex-col gap-2 max-w-[200px] w-full text-xs">
        {data.map((item, i) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={i} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-muted/40 border border-border/50">
              <div className="flex items-center gap-2 truncate">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                />
                <span className="truncate text-muted-foreground font-medium">{item.label}</span>
              </div>
              <span className="font-bold [font-family:Arial,sans-serif] text-foreground shrink-0">
                {item.value} <span className="text-[10px] font-normal text-muted-foreground">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
