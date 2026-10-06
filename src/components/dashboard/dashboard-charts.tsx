"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Wallet, Target, Receipt, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, LineChart, BarChart3 } from "lucide-react";

export interface MonthlyTrendPoint {
  month: string;
  inflow: number;
  expense: number;
}

export interface ExpenseSlice {
  name: string;
  value: number;
  color?: string;
}

interface FinancialHealthChartProps {
  data: MonthlyTrendPoint[];
  remainingBudget: number;
  totalPostedExpenses: number;
  totalTreasuryBalance: number;
  totalAllocatedBudget: number;
  locale: string;
}

type PeriodFilter = "3m" | "6m" | "1y";

interface FinancialCustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  locale: string;
  currencyUnit: string;
}

function FinancialCustomTooltip({
  active,
  payload,
  label,
  locale,
  currencyUnit
}: FinancialCustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const isAr = locale === "ar";
  const inflowItem = payload.find((p) => p.dataKey === "inflow");
  const expenseItem = payload.find((p) => p.dataKey === "expense");

  const inflowVal = Number(inflowItem?.value ?? 0);
  const expenseVal = Number(expenseItem?.value ?? 0);
  const net = inflowVal - expenseVal;
  const isNetPositive = net >= 0;

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="z-50 min-w-[200px] rounded-xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md transition-all text-xs"
    >
      {/* Month Label Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60 mb-2">
        <span className="font-bold text-foreground text-sm">{label}</span>
        <span
          className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold ${
            isNetPositive
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
          }`}
        >
          {isNetPositive ? "+" : ""}
          {net.toLocaleString(locale)} {currencyUnit}
        </span>
      </div>

      {/* Breakdown Rows */}
      <div className="space-y-1.5 font-mono">
        {/* Inflow */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-muted-foreground font-sans text-xs">
              {isAr ? "الإيداعات" : "Dépôts"}
            </span>
          </div>
          <span className="font-bold text-foreground tabular-nums">
            {inflowVal.toLocaleString(locale)}{" "}
            <span className="text-[10px] text-muted-foreground font-normal">{currencyUnit}</span>
          </span>
        </div>

        {/* Expense */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-600 shrink-0" />
            <span className="text-muted-foreground font-sans text-xs">
              {isAr ? "المصاريف والسحوبات" : "Dépenses & Retraits"}
            </span>
          </div>
          <span className="font-bold text-foreground tabular-nums">
            {expenseVal.toLocaleString(locale)}{" "}
            <span className="text-[10px] text-muted-foreground font-normal">{currencyUnit}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function FinancialHealthChart({
  data,
  remainingBudget,
  totalPostedExpenses,
  totalTreasuryBalance,
  totalAllocatedBudget,
  locale
}: FinancialHealthChartProps) {
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>("6m");
  const [chartView, setChartView] = useState<"area" | "bar">("area");
  const isAr = locale === "ar";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-72 w-full animate-pulse rounded-2xl bg-muted/40" />;
  }

  // Filter data based on selected period
  const slicedData = (() => {
    if (!data || data.length === 0) return [];
    if (period === "3m") return data.slice(-3);
    if (period === "6m") return data.slice(-6);
    return data;
  })();

  const currencyUnit = isAr ? "د.ج" : "DZD";

  // Formatter for DZD ticks
  const formatYTick = (val: number) => {
    if (val === 0) return `0 ${currencyUnit}`;
    if (val >= 1_000_000) {
      const millions = (val / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 });
      return `${millions} ${isAr ? "مليون د.ج" : "M DZD"}`;
    }
    if (val >= 1_000) {
      const thousands = (val / 1_000).toLocaleString(locale, { maximumFractionDigits: 0 });
      return `${thousands} ${isAr ? "ألف د.ج" : "k DZD"}`;
    }
    return `${val} ${currencyUnit}`;
  };

  // Budget consumption percentage
  const budgetConsumedPct = totalAllocatedBudget > 0
    ? Math.min(100, Math.round((totalPostedExpenses / totalAllocatedBudget) * 100))
    : 0;

  return (
    <div className="w-full space-y-5">
      {/* 3 Executive Finance Pills (Remaining Budget, Expenses, Treasury) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Metric 1: Remaining Budget */}
        <div className="relative overflow-hidden rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
              {isAr ? "الميزانية المتبقية" : "Budget Restant"}
            </span>
            <Target className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-base font-black font-mono tabular-nums text-foreground">
              {remainingBudget.toLocaleString(locale)}{" "}
              <span className="text-[10px] font-normal text-muted-foreground">{currencyUnit}</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-muted-foreground">
              {100 - budgetConsumedPct}% {isAr ? "متاح" : "disp."}
            </span>
          </div>
          {/* Progress track */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-500/15">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.max(4, 100 - budgetConsumedPct)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Total Expenses */}
        <div className="relative overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5 p-3.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
              {isAr ? "المصاريف" : "Dépenses"}
            </span>
            <Receipt className="h-4 w-4 text-red-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-base font-black font-mono tabular-nums text-foreground">
              {totalPostedExpenses.toLocaleString(locale)}{" "}
              <span className="text-[10px] font-normal text-muted-foreground">{currencyUnit}</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-red-600 dark:text-red-400">
              {budgetConsumedPct}% {isAr ? "مستهلك" : "consommé"}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-red-500/15">
            <div
              className="h-full rounded-full bg-red-600 transition-all duration-500"
              style={{ width: `${Math.max(4, budgetConsumedPct)}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Treasury Cash Balance */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {isAr ? "رصيد الخزينة" : "Trésorerie Disponible"}
            </span>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-base font-black font-mono tabular-nums text-foreground">
              {totalTreasuryBalance.toLocaleString(locale)}{" "}
              <span className="text-[10px] font-normal text-muted-foreground">{currencyUnit}</span>
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="h-3 w-3" />
              <span>{isAr ? "سيولة نشطة" : "Liquide"}</span>
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/15">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500 w-full" />
          </div>
        </div>
      </div>

      {/* Control Toolbar: Period & Chart View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
        <div
          role="group"
          aria-label={isAr ? "طريقة عرض الرسم البياني" : "Mode d’affichage du graphique"}
          className="inline-flex items-center gap-0.5 rounded-xl border border-border/70 bg-muted/60 p-1 shadow-sm"
        >
          <button
            type="button"
            onClick={() => setChartView("area")}
            title={isAr ? "منحنى انسيابي" : "Courbes"}
            aria-label={isAr ? "منحنى انسيابي" : "Courbes"}
            aria-pressed={chartView === "area"}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 cursor-pointer ${
              chartView === "area"
                ? "border-club-primary/25 bg-club-primary text-white shadow-sm"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
            }`}
          >
            <LineChart className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => setChartView("bar")}
            title={isAr ? "أعمدة مقارنة" : "Barres"}
            aria-label={isAr ? "أعمدة مقارنة" : "Barres"}
            aria-pressed={chartView === "bar"}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 cursor-pointer ${
              chartView === "bar"
                ? "border-club-primary/25 bg-club-primary text-white shadow-sm"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* Time Period Filter Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl">
          {(
            [
              { id: "3m", labelAr: "آخر 3 أشهر", labelFr: "3 Mois" },
              { id: "6m", labelAr: "آخر 6 أشهر", labelFr: "6 Mois" },
              { id: "1y", labelAr: "سنة كاملة", labelFr: "1 An" }
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                period === item.id
                  ? "bg-club-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isAr ? item.labelAr : item.labelFr}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div key={chartView} dir="ltr" className="chart-view-transition h-64 min-h-[256px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartView === "area" ? (
            <AreaChart data={slicedData} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="colorInflowAdv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorExpenseAdv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />

              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
              />

              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYTick}
                width={85}
                tickMargin={6}
                domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax * 1.15), 10000)]}
              />

              <Tooltip
                wrapperStyle={{ zIndex: 60, pointerEvents: "none" }}
                cursor={{
                  stroke: "rgba(220, 38, 38, 0.4)",
                  strokeWidth: 1.5,
                  strokeDasharray: "4 4",
                  fill: "transparent"
                }}
                content={<FinancialCustomTooltip locale={locale} currencyUnit={currencyUnit} />}
              />

              <Area
                type="monotone"
                dataKey="inflow"
                stroke="#10B981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorInflowAdv)"
                name="inflow"
                dot={{ r: 3.5, fill: "#10B981", strokeWidth: 2, stroke: "#ffffff" }}
                activeDot={{ r: 5, fill: "#34D399", strokeWidth: 2, stroke: "#ffffff" }}
              />

              <Area
                type="monotone"
                dataKey="expense"
                stroke="#DC2626"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorExpenseAdv)"
                name="expense"
                dot={{ r: 3.5, fill: "#DC2626", strokeWidth: 2, stroke: "#ffffff" }}
                activeDot={{ r: 5, fill: "#EF4444", strokeWidth: 2, stroke: "#ffffff" }}
              />
            </AreaChart>
          ) : (
            <BarChart data={slicedData} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYTick}
                width={85}
                tickMargin={6}
                domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax * 1.15), 10000)]}
              />
              <Tooltip
                wrapperStyle={{ zIndex: 60, pointerEvents: "none" }}
                cursor={{ fill: "rgba(128, 128, 128, 0.08)" }}
                content={<FinancialCustomTooltip locale={locale} currencyUnit={currencyUnit} />}
              />
              <Bar dataKey="inflow" fill="#10B981" radius={[4, 4, 0, 0]} name="inflow" />
              <Bar dataKey="expense" fill="#DC2626" radius={[4, 4, 0, 0]} name="expense" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend Footer */}
      <div className="pt-3 border-t border-border/60 flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span>{isAr ? "الإيداعات" : "Dépôts"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
          <span>{isAr ? "المصاريف والسحوبات" : "Dépenses & Retraits"}</span>
        </div>
      </div>
    </div>
  );
}

// Keep ExpenseDistributionDonut export for modular use
export function ExpenseDistributionDonut({
  slices,
  totalAmount,
  locale
}: {
  slices: ExpenseSlice[];
  totalAmount: number;
  locale: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const isAr = locale === "ar";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-48 w-full animate-pulse rounded-2xl bg-muted/30" />;
  }

  const currencyUnit = isAr ? "د.ج" : "DZD";

  const EXTENDED_PALETTE = [
    { bg: "bg-red-600 dark:bg-red-500", text: "text-red-600 dark:text-red-400", hex: "#DC2626", gradient: "from-red-600 to-rose-700", ring: "ring-red-500/30" },
    { bg: "bg-amber-500 dark:bg-amber-400", text: "text-amber-600 dark:text-amber-400", hex: "#F59E0B", gradient: "from-amber-500 to-orange-600", ring: "ring-amber-500/30" },
    { bg: "bg-emerald-500 dark:bg-emerald-400", text: "text-emerald-600 dark:text-emerald-400", hex: "#10B981", gradient: "from-emerald-500 to-teal-700", ring: "ring-emerald-500/30" },
    { bg: "bg-indigo-500 dark:bg-indigo-400", text: "text-indigo-600 dark:text-indigo-400", hex: "#6366F1", gradient: "from-indigo-500 to-blue-700", ring: "ring-indigo-500/30" },
    { bg: "bg-purple-500 dark:bg-purple-400", text: "text-purple-600 dark:text-purple-400", hex: "#A855F7", gradient: "from-purple-500 to-pink-700", ring: "ring-purple-500/30" },
    { bg: "bg-cyan-500 dark:bg-cyan-400", text: "text-cyan-600 dark:text-cyan-400", hex: "#06B6D4", gradient: "from-cyan-500 to-teal-600", ring: "ring-cyan-500/30" },
    { bg: "bg-blue-500 dark:bg-blue-400", text: "text-blue-600 dark:text-blue-400", hex: "#3B82F6", gradient: "from-blue-500 to-sky-600", ring: "ring-blue-500/30" },
    { bg: "bg-rose-500 dark:bg-rose-400", text: "text-rose-600 dark:text-rose-400", hex: "#F43F5E", gradient: "from-rose-500 to-red-600", ring: "ring-rose-500/30" },
    { bg: "bg-teal-500 dark:bg-teal-400", text: "text-teal-600 dark:text-teal-400", hex: "#14B8A6", gradient: "from-teal-500 to-emerald-600", ring: "ring-teal-500/30" },
    { bg: "bg-violet-500 dark:bg-violet-400", text: "text-violet-600 dark:text-violet-400", hex: "#8B5CF6", gradient: "from-violet-500 to-purple-600", ring: "ring-violet-500/30" },
    { bg: "bg-zinc-500 dark:bg-zinc-400", text: "text-zinc-600 dark:text-zinc-400", hex: "#71717A", gradient: "from-zinc-500 to-zinc-700", ring: "ring-zinc-500/30" }
  ];

  const validSlices = (slices || []).filter((s) => s.value > 0);
  const calculatedTotal = validSlices.reduce((acc, s) => acc + s.value, 0) || totalAmount || 0;

  if (validSlices.length === 0 || calculatedTotal === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border border-dashed border-border/80 bg-muted/20">
        <BarChart3 className="h-7 w-7 text-muted-foreground/50 mb-1" />
        <p className="text-xs font-semibold text-muted-foreground">
          {isAr ? "لا توجد مصروفات مسجلة حالياً" : "Aucune dépense enregistrée"}
        </p>
      </div>
    );
  }

  // Sort slices descending to prioritize major expense categories
  const sortedSlices = [...validSlices].sort((a, b) => b.value - a.value);

  // If there are more than 7 categories, group tail categories into "أخرى" to keep layout pristine
  const MAX_PRIMARY_SLICES = 7;
  let displaySlices: ExpenseSlice[] = [];
  if (sortedSlices.length <= MAX_PRIMARY_SLICES) {
    displaySlices = sortedSlices;
  } else {
    const topSlices = sortedSlices.slice(0, MAX_PRIMARY_SLICES - 1);
    const tailSlices = sortedSlices.slice(MAX_PRIMARY_SLICES - 1);
    const tailSum = tailSlices.reduce((acc, item) => acc + item.value, 0);
    displaySlices = [
      ...topSlices,
      {
        name: isAr ? `أخرى (${tailSlices.length} بنود إضافية)` : `Autres (${tailSlices.length} postes)`,
        value: tailSum
      }
    ];
  }

  return (
    <div className="w-full space-y-4">
      {/* Top Overview Bar */}
      <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 border border-border/60">
        <div>
          <span className="text-[11px] font-medium text-muted-foreground block">
            {isAr ? "إجمالي المصروفات المنفذة" : "Total des dépenses engagées"}
          </span>
          <span className="font-mono text-base font-bold text-foreground">
            {calculatedTotal.toLocaleString(locale)} <span className="text-xs font-normal text-muted-foreground">{currencyUnit}</span>
          </span>
        </div>
        <div className="text-end">
          <span className="inline-flex items-center gap-1 rounded-full bg-club-primary/10 border border-club-primary/20 px-2.5 py-0.5 text-[11px] font-bold text-club-primary">
            <span>{validSlices.length}</span>
            <span>{isAr ? "أبواب صرف مسجلة" : "postes de dépenses"}</span>
          </span>
        </div>
      </div>

      {/* Multi-Segment Distribution Bar */}
      <div className="space-y-1.5">
        <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-muted/60 p-0.5 shadow-inner">
          {displaySlices.map((slice, index) => {
            const color = EXTENDED_PALETTE[index % EXTENDED_PALETTE.length]!;
            const pct = Math.max(2, (slice.value / calculatedTotal) * 100);
            const isHovered = hoveredIndex === index;

            return (
              <div
                key={slice.name}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ width: `${pct}%` }}
                title={`${slice.name}: ${slice.value.toLocaleString(locale)} ${currencyUnit} (${Math.round((slice.value / calculatedTotal) * 100)}%)`}
                className={`h-full cursor-pointer transition-all duration-300 first:rounded-s-full last:rounded-e-full bg-gradient-to-r ${color.gradient} ${
                  isHovered ? "brightness-125 scale-y-110 shadow-xs" : "hover:brightness-110"
                }`}
              />
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          {isAr ? "مرر المؤشر على أي بند لمعاينة النسبة والتفاصيل" : "Survolez une section pour voir le détail"}
        </p>
      </div>

      {/* Breakdown Cards Grid (Responsive 1 or 2 cols depending on card count) */}
      <div className={`grid gap-2 pt-1 ${displaySlices.length > 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
        {displaySlices.map((slice, index) => {
          const color = EXTENDED_PALETTE[index % EXTENDED_PALETTE.length]!;
          const pct = Math.round((slice.value / calculatedTotal) * 100);
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={slice.name}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`rounded-xl p-2.5 transition-all duration-200 border ${
                isHovered
                  ? `bg-muted/80 border-border ring-2 ${color.ring} shadow-xs`
                  : "bg-card/60 hover:bg-muted/40 border-border/60"
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${color.bg} shadow-2xs`}
                  />
                  <span className="font-semibold text-foreground truncate text-xs">
                    {slice.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs font-bold text-foreground">
                    {slice.value.toLocaleString(locale)}{" "}
                    <span className="text-[10px] text-muted-foreground font-normal">{currencyUnit}</span>
                  </span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold font-mono text-foreground border border-border/60">
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Progress track */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${color.gradient} transition-all duration-500`}
                  style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Backward-compatible export for TreasuryTrendChart
export const TreasuryTrendChart = FinancialHealthChart;
