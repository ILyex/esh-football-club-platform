"use client";

import { useState } from "react";
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
} from "recharts";
import { Trophy, TrendingUp, Activity } from "lucide-react";

export interface EvolutionPoint {
  sessionId: string;
  sessionTitle: string;
  dateStr: string;
  avgDistance: number;
  maxDistance: number;
  avgVo2: number;
  maxVo2: number;
  playerCount: number;
}

export interface TopAthleteItem {
  id: string;
  fullName: string;
  shirtNumber: number | null;
  position: string;
  photoUrl: string | null;
  distance: number;
  vo2max: number;
  levelDisplay: string;
}

interface TestingAnalyticsChartsProps {
  evolutionData: EvolutionPoint[];
  topAthletes: TopAthleteItem[];
  locale: string;
}

export function TestingAnalyticsCharts({
  evolutionData,
  topAthletes,
  locale
}: TestingAnalyticsChartsProps) {
  const [activeTab, setActiveTab] = useState<"evolution" | "ranking">("evolution");
  const isAr = locale === "ar";


  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
      {/* Chart Navigation Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground sm:text-base">
              {isAr ? "التحليلات والمؤشرات البيانية للياقة البدنية" : "Analyses & Indicateurs de Condition Physique"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {isAr ? "تطور نتائج Yo‑Yo IR1 وترتيب اللاعبين حسب المسافة المسجلة" : "Évolution des résultats Yo‑Yo IR1 et classement par distance enregistrée"}
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("evolution")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition-all ${
              activeTab === "evolution"
                ? "bg-card text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span>{isAr ? "منحنى التطور" : "Évolution"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ranking")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition-all ${
              activeTab === "ranking"
                ? "bg-card text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span>{isAr ? "صدارة التحمل" : "Top Athlètes"}</span>
          </button>
        </div>
      </div>

      {/* 1. Evolution Tab */}
      {activeTab === "evolution" && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1">
            <span className="font-medium">
              {isAr
                ? "مقارنة متوسط المسافة وأعلى مسافة مقطوعة عبر الجلسات (بالمتر)"
                : "Moyenne et pic de distance parcourue par session (mètres)"}
            </span>
            <div className="flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span>{isAr ? "أعلى مسافة (القمة)" : "Distance Max"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span>{isAr ? "متوسط الفريق" : "Moyenne Équipe"}</span>
              </div>
            </div>
          </div>

          {evolutionData.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/10 text-xs text-muted-foreground">
              <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p>{isAr ? "لا توجد جلسات اختبار مكتملة مسجلة بعد لعرض المنحنى." : "Aucune session complétée pour afficher l'évolution."}</p>
            </div>
          ) : (
            <div dir="ltr" className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionData} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                  <defs>
                    <linearGradient id="colorMaxDist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorAvgDist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="dateStr"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    interval="preserveStartEnd"
                    minTickGap={14}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val} م`}
                    width={70}
                    tickMargin={8}
                    domain={[0, (max: number) => Math.max(Math.ceil(max * 1.15), 1000)]}
                  />
                  <Tooltip
                    cursor={{
                      stroke: "rgba(16, 185, 129, 0.4)",
                      strokeWidth: 1.5,
                      strokeDasharray: "4 4",
                      fill: "transparent"
                    }}
                    formatter={(value: any, name: any) => [
                      `${Number(value).toLocaleString(locale)} م`,
                      name === "maxDistance"
                        ? isAr ? "أعلى مسافة (القمة)" : "Pic de Distance"
                        : isAr ? "متوسط مسافة الفريق" : "Moyenne Équipe"
                    ]}
                    labelFormatter={(label: any, items: any) => {
                      const payload = items?.[0]?.payload as EvolutionPoint | undefined;
                      return payload ? payload.sessionTitle : label;
                    }}
                    wrapperStyle={{ outline: "none", zIndex: 50 }}
                    contentStyle={{
                      backgroundColor: "rgba(18, 20, 26, 0.95)",
                      borderColor: "rgba(255, 255, 255, 0.15)",
                      color: "#ffffff",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                      direction: isAr ? "rtl" : "ltr",
                      textAlign: isAr ? "right" : "left",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                      backdropFilter: "blur(10px)"
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="maxDistance"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorMaxDist)"
                    name="maxDistance"
                    dot={{ r: 4, fill: "#10B981", strokeWidth: 2, stroke: "#ffffff" }}
                    activeDot={{ r: 6, fill: "#34D399", strokeWidth: 2, stroke: "#ffffff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgDistance"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAvgDist)"
                    name="avgDistance"
                    dot={{ r: 4, fill: "#3B82F6", strokeWidth: 2, stroke: "#ffffff" }}
                    activeDot={{ r: 6, fill: "#60A5FA", strokeWidth: 2, stroke: "#ffffff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* 3. Top Athletes Ranking Tab */}
      {activeTab === "ranking" && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "اللاعبون أصحاب أعلى مسافة مسجلة في اختبار يويو IR1؛ قيمة VO₂ المعروضة تقديرية"
              : "Meilleures distances enregistrées au Yo-Yo IR1 ; la valeur VO₂ affichée est estimative"}
          </p>

          {topAthletes.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/10 text-xs text-muted-foreground">
              <Trophy className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p>{isAr ? "لا توجد نتائج لاعبين مسجلة بعد لتحديد الصدارة." : "Aucun résultat pour établir le classement."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {topAthletes.slice(0, 6).map((athlete, index) => {
                const rankColor =
                  index === 0
                    ? "border-amber-400 bg-amber-500/10 text-amber-600"
                    : index === 1
                    ? "border-slate-300 bg-slate-400/10 text-slate-600"
                    : index === 2
                    ? "border-amber-700 bg-amber-700/10 text-amber-800"
                    : "border-border bg-card text-muted-foreground";

                return (
                  <div
                    key={athlete.id}
                    className="relative flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-2xs hover:border-emerald-500/40 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono font-bold text-xs ${rankColor}`}
                      >
                        #{index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground truncate">
                            {athlete.fullName}
                          </p>
                          {athlete.shirtNumber && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              #{athlete.shirtNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{athlete.position}</p>
                      </div>
                    </div>

                    <div className="text-end shrink-0">
                      <div className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                        {athlete.distance.toLocaleString(locale)} م
                      </div>
                      <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                        VO₂: {athlete.vo2max}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
