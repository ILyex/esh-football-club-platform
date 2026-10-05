"use client";

import { useState, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Calendar, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { FINANCE_COLORS } from "@/lib/finance/colors";

export type CashflowDataPoint = {
  date: string;
  deposit: number;
  withdrawal: number;
  label: string;
  timestamp: number;
};

interface TreasuryCashflowChartProps {
  transactions: {
    id: string;
    type: "DEPOSIT" | "WITHDRAWAL";
    amount: number;
    transactionDate: Date | string;
    description?: string | null;
  }[];
  locale?: string;
}

export function TreasuryCashflowChart({ transactions, locale = "ar" }: TreasuryCashflowChartProps) {
  const [period, setPeriod] = useState<"MONTH" | "SIX_MONTHS" | "YEAR" | "ALL">("SIX_MONTHS");

  const currencySuffix = locale === "ar" ? " دج" : " DZD";

  const filteredData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return transactions.filter((t) => {
      const d = new Date(t.transactionDate);
      if (period === "MONTH") {
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }
      if (period === "SIX_MONTHS") {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        return d >= sixMonthsAgo;
      }
      if (period === "YEAR") {
        return d.getFullYear() === currentYear;
      }
      return true;
    });
  }, [transactions, period]);

  // Aggregate by month or by day depending on period
  const chartData = useMemo(() => {
    const isDaily = period === "MONTH";
    const map = new Map<string, { label: string; deposit: number; withdrawal: number; timestamp: number }>();

    for (const t of filteredData) {
      const d = new Date(t.transactionDate);
      const key = isDaily
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const label = isDaily
        ? `${d.getDate()} ${new Intl.DateTimeFormat(locale, { month: "short" }).format(d)}`
        : new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(d);

      if (!map.has(key)) {
        map.set(key, { label, deposit: 0, withdrawal: 0, timestamp: d.getTime() });
      }

      const item = map.get(key)!;
      if (t.type === "DEPOSIT") {
        item.deposit += t.amount;
      } else {
        item.withdrawal += t.amount;
      }
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, v]) => v);
  }, [filteredData, period, locale]);

  const totals = useMemo(() => {
    let deposit = 0;
    let withdrawal = 0;
    for (const t of filteredData) {
      if (t.type === "DEPOSIT") deposit += t.amount;
      else withdrawal += t.amount;
    }
    return { deposit, withdrawal, net: deposit - withdrawal };
  }, [filteredData]);

  const periods = [
    { key: "MONTH", label: locale === "ar" ? "الشهر الحالي" : "Mois en cours" },
    { key: "SIX_MONTHS", label: locale === "ar" ? "آخر 6 أشهر" : "6 derniers mois" },
    { key: "YEAR", label: locale === "ar" ? "السنة الحالية" : "Année en cours" },
    { key: "ALL", label: locale === "ar" ? "كافة الفترات" : "Toutes les dates" }
  ] as const;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
      {/* Top Header & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 text-club-primary" />
            <span>{locale === "ar" ? "حركة الخزينة" : "Flux de Trésorerie"}</span>
          </h2>
        </div>

        {/* Period Filter Pills */}
        <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                period === p.key
                  ? "bg-card text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`rounded-xl border ${FINANCE_COLORS.deposits.border} ${FINANCE_COLORS.deposits.bg} p-3`}>
          <div className={`flex items-center justify-between text-xs ${FINANCE_COLORS.deposits.text} font-medium`}>
            <span>{locale === "ar" ? "إجمالي الإيداعات" : "Total des dépôts"}</span>
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <p className={`mt-1 font-mono text-base font-bold ${FINANCE_COLORS.deposits.text}`} dir="ltr">
            +{totals.deposit.toLocaleString(locale)} {currencySuffix}
          </p>
        </div>

        <div className={`rounded-xl border ${FINANCE_COLORS.withdrawals.border} ${FINANCE_COLORS.withdrawals.bg} p-3`}>
          <div className={`flex items-center justify-between text-xs ${FINANCE_COLORS.withdrawals.text} font-medium`}>
            <span>{locale === "ar" ? "إجمالي السحوبات" : "Total Retraits"}</span>
            <TrendingDown className="h-3.5 w-3.5" />
          </div>
          <p className={`mt-1 font-mono text-base font-bold ${FINANCE_COLORS.withdrawals.text}`} dir="ltr">
            -{totals.withdrawal.toLocaleString(locale)} {currencySuffix}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>{locale === "ar" ? "صافي السيولة للفترة" : "Solde net période"}</span>
            <Wallet className="h-3.5 w-3.5" />
          </div>
          <p
            className={`mt-1 font-mono text-base font-bold ${
              totals.net >= 0 ? FINANCE_COLORS.cash.text : FINANCE_COLORS.expenses.text
            }`}
            dir="ltr"
          >
            {totals.net.toLocaleString(locale)} {currencySuffix}
          </p>
        </div>
      </div>

      {/* Recharts Bar Container with isolated LTR coordinate system */}
      <div className="pt-2">
        {chartData.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
            {locale === "ar" ? "لا توجد حركات مالية مسجلة لهذه الفترة." : "Aucun mouvement enregistré pour cette période."}
          </div>
        ) : (
          <div dir="ltr" className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis
                  dataKey="label"
                  fontSize={11}
                  stroke="currentColor"
                  opacity={0.7}
                  tickMargin={8}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis
                  fontSize={10}
                  stroke="currentColor"
                  opacity={0.7}
                  tickFormatter={(val) => {
                    if (val === 0) return `0${currencySuffix}`;
                    if (val >= 1_000_000) {
                      return `${(val / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })} ${locale === "ar" ? "مليون دج" : "M DZD"}`;
                    }
                    if (val >= 1_000) {
                      return `${(val / 1_000).toLocaleString(locale, { maximumFractionDigits: 0 })} ${locale === "ar" ? "ألف دج" : "k DZD"}`;
                    }
                    return `${val}${currencySuffix}`;
                  }}
                  width={85}
                  tickMargin={8}
                />
                <Tooltip
                  cursor={{ fill: "rgba(120, 120, 120, 0.08)" }}
                  formatter={(value: any, name: any) => [
                    `${Number(value).toLocaleString(locale)} ${currencySuffix}`,
                    name === "deposit"
                      ? locale === "ar" ? "الإيداعات" : "Dépôts"
                      : locale === "ar" ? "السحوبات" : "Retraits"
                  ]}
                  wrapperStyle={{ outline: "none", zIndex: 50 }}
                  contentStyle={{
                    backgroundColor: "rgba(18, 20, 26, 0.95)",
                    borderColor: "rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                    direction: locale === "ar" ? "rtl" : "ltr",
                    textAlign: locale === "ar" ? "right" : "left",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                    backdropFilter: "blur(10px)"
                  }}
                  itemStyle={{ color: "#ffffff" }}
                  labelStyle={{ color: "#9ca3af", fontWeight: 600, marginBottom: "4px" }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: "11px", paddingBottom: "12px" }}
                  formatter={(val) => (val === "deposit" ? (locale === "ar" ? "الإيداعات" : "Dépôts") : locale === "ar" ? "السحوبات" : "Retraits")}
                />
                <Bar dataKey="deposit" name="deposit" fill={FINANCE_COLORS.deposits.fill} radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="withdrawal" name="withdrawal" fill={FINANCE_COLORS.withdrawals.fill} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
