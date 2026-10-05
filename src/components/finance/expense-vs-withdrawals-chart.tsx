"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { ArrowUpRight, Receipt, Wallet, Percent, Calendar } from "lucide-react";
import { FINANCE_COLORS } from "@/lib/finance/colors";

interface ExpenseVsWithdrawalsChartProps {
  withdrawals: {
    id: string;
    amount: number;
    transactionDate: Date | string;
    description?: string | null;
  }[];
  expenses: {
    id: string;
    amount: number;
    date: Date | string;
    description?: string | null;
    category?: string | null;
  }[];
  locale?: string;
}

export function ExpenseVsWithdrawalsChart({
  withdrawals,
  expenses,
  locale = "ar"
}: ExpenseVsWithdrawalsChartProps) {
  const [period, setPeriod] = useState<"MONTH" | "SIX_MONTHS" | "YEAR" | "ALL">("SIX_MONTHS");

  const currencySuffix = locale === "ar" ? " دج" : " DZD";

  // Filter both withdrawals and expenses by selected period
  const { filteredWithdrawals, filteredExpenses } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const isMatch = (dateVal: Date | string) => {
      const d = new Date(dateVal);
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
    };

    return {
      filteredWithdrawals: withdrawals.filter((w) => isMatch(w.transactionDate)),
      filteredExpenses: expenses.filter((e) => isMatch(e.date))
    };
  }, [withdrawals, expenses, period]);

  // Totals for the KPI strip
  const totals = useMemo(() => {
    const totalWithdrawal = filteredWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    const totalExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = totalWithdrawal - totalExpense;
    const justificationRate =
      totalWithdrawal > 0 ? Math.min(100, Math.floor((totalExpense * 100) / totalWithdrawal)) : 0;

    return {
      withdrawal: totalWithdrawal,
      expense: totalExpense,
      remaining,
      justificationRate
    };
  }, [filteredWithdrawals, filteredExpenses]);

  // Aggregate by month or by day depending on period
  const chartData = useMemo(() => {
    const isDaily = period === "MONTH";
    const map = new Map<
      string,
      { label: string; withdrawal: number; expense: number; remaining: number; timestamp: number }
    >();

    // Process withdrawals
    for (const w of filteredWithdrawals) {
      const d = new Date(w.transactionDate);
      const key = isDaily
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const label = isDaily
        ? `${d.getDate()} ${new Intl.DateTimeFormat(locale, { month: "short" }).format(d)}`
        : new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(d);

      if (!map.has(key)) {
        map.set(key, { label, withdrawal: 0, expense: 0, remaining: 0, timestamp: d.getTime() });
      }

      map.get(key)!.withdrawal += w.amount;
    }

    // Process expenses
    for (const e of filteredExpenses) {
      const d = new Date(e.date);
      const key = isDaily
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const label = isDaily
        ? `${d.getDate()} ${new Intl.DateTimeFormat(locale, { month: "short" }).format(d)}`
        : new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(d);

      if (!map.has(key)) {
        map.set(key, { label, withdrawal: 0, expense: 0, remaining: 0, timestamp: d.getTime() });
      }

      map.get(key)!.expense += e.amount;
    }

    // Calculate remaining for each bucket
    for (const item of map.values()) {
      item.remaining = item.withdrawal - item.expense;
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, v]) => v);
  }, [filteredWithdrawals, filteredExpenses, period, locale]);

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
            <Receipt className={`h-4.5 w-4.5 ${FINANCE_COLORS.expenses.text}`} />
            <span>
              {locale === "ar"
                ? "مقارنة السحوبات، المصاريف، والرصيد المتبقي"
                : "Retraits, Dépenses et Solde Restant"}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === "ar"
              ? "متابعة سيولة الصندوق: الأموال المسحوبة نقداً مقابل النفقات المبررة رسمياً بالفواتير"
              : "Suivi de caisse : fonds retirés contre dépenses justifiées par pièces comptables"}
          </p>
        </div>

        {/* Period Filter Pills */}
        <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs self-start sm:self-auto">
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

      {/* KPI Cards Strip: السحوبات | المصاريف | المتبقي */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. السحوبات (Withdrawals) */}
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5">
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-medium">
            <span>{locale === "ar" ? "1. إجمالي السحوبات (نقد الصندوق)" : "1. Total des Retraits"}</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-amber-700 dark:text-amber-400">
            {totals.withdrawal.toLocaleString(locale)} {currencySuffix}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {locale === "ar" ? "أموال مسحوبة لتغطية النفقات" : "Fonds décaissés pour fonctionnement"}
          </p>
        </div>

        {/* 2. المصاريف (Expenses) */}
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3.5">
          <div className="flex items-center justify-between text-xs text-red-700 dark:text-red-400 font-medium">
            <span>{locale === "ar" ? "2. إجمالي المصاريف (المبررة)" : "2. Dépenses Justifiées"}</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/10 text-red-600">
              <Receipt className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-red-700 dark:text-red-400">
            {totals.expense.toLocaleString(locale)} {currencySuffix}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {locale === "ar" ? "نفقات" : "Dépenses"}
          </p>
        </div>

        {/* 3. المتبقي (Remaining Cash Balance) */}
        <div
          className={`rounded-xl border p-3.5 ${
            totals.remaining >= 0
                ? `${FINANCE_COLORS.cash.border} ${FINANCE_COLORS.cash.bg}`
              : `${FINANCE_COLORS.expenses.border} ${FINANCE_COLORS.expenses.bg}`
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium">
            <span
              className={
                totals.remaining >= 0
                  ? FINANCE_COLORS.cash.text
                  : FINANCE_COLORS.expenses.text
              }
            >
              {locale === "ar" ? "3. الرصيد المتبقي في الصندوق" : "3. Solde Caisse Restant"}
            </span>
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-md ${
                totals.remaining >= 0
                  ? `${FINANCE_COLORS.cash.bg} ${FINANCE_COLORS.cash.text}`
                  : `${FINANCE_COLORS.expenses.bg} ${FINANCE_COLORS.expenses.text}`
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />
            </div>
          </div>
          <p
            className={`mt-2 font-mono text-xl font-bold ${
              totals.remaining >= 0
                ? FINANCE_COLORS.cash.text
                : FINANCE_COLORS.expenses.text
            }`}
          >
            {totals.remaining.toLocaleString(locale)} {currencySuffix}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>
              {totals.remaining >= 0
                ? locale === "ar"
                  ? "سيولة متوفرة في انتظار صرفها"
                  : "Fonds disponibles en caisse"
                : locale === "ar"
                ? "تجاوز: المصاريف تفوق السحب"
                : "Dépenses supérieures aux retraits"}
            </span>
            {totals.withdrawal > 0 && (
              <span className="font-semibold text-foreground/80">
                {totals.justificationRate}% {locale === "ar" ? "مُبرَّر" : "justifié"}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Recharts Bar Container */}
      <div className="pt-2">
        {chartData.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
            {locale === "ar"
              ? "لا توجد سحوبات أو مصاريف مسجلة لهذه الفترة."
              : "Aucune opération enregistrée pour cette période."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="label" fontSize={11} stroke="currentColor" opacity={0.7} />
              <YAxis
                fontSize={10}
                stroke="currentColor"
                opacity={0.7}
                tickFormatter={(val) => {
                  if (val === 0) return `0${currencySuffix}`;
                  if (Math.abs(val) >= 1_000_000) {
                    return `${(val / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })} ${
                      locale === "ar" ? "مليون دج" : "M DZD"
                    }`;
                  }
                  if (Math.abs(val) >= 1_000) {
                    return `${(val / 1_000).toLocaleString(locale, { maximumFractionDigits: 0 })} ${
                      locale === "ar" ? "ألف دج" : "k DZD"
                    }`;
                  }
                  return `${val}${currencySuffix}`;
                }}
                width={85}
              />
              <Tooltip
                cursor={{ fill: "rgba(120, 120, 120, 0.08)" }}
                formatter={(value: any, name: any) => {
                  const val = Number(value);
                  const formatted = `${val.toLocaleString(locale)} ${currencySuffix}`;
                  if (name === "withdrawal") {
                    return [formatted, locale === "ar" ? "السحوبات (نقد الصندوق)" : "Retraits"];
                  }
                  if (name === "expense") {
                    return [formatted, locale === "ar" ? "المصاريف (المبررة)" : "Dépenses"];
                  }
                  return [formatted, locale === "ar" ? "الرصيد المتبقي" : "Solde Restant"];
                }}
                contentStyle={{
                  backgroundColor: "rgba(18, 20, 26, 0.95)",
                  borderColor: "rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
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
                formatter={(val) => {
                  if (val === "withdrawal") return locale === "ar" ? "السحوبات" : "Retraits";
                  if (val === "expense") return locale === "ar" ? "المصاريف" : "Dépenses";
                  return locale === "ar" ? "المتبقي" : "Restant";
                }}
              />
              <Bar
                dataKey="withdrawal"
                name="withdrawal"
                fill={FINANCE_COLORS.withdrawals.fill}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="expense"
                name="expense"
                fill={FINANCE_COLORS.expenses.fill}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="remaining"
                name="remaining"
                fill={FINANCE_COLORS.cash.fill}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
