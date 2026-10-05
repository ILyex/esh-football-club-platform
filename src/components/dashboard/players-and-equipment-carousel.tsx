"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Package,
  Shield,
  Activity,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Shirt,
  Sparkles
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from "recharts";

export interface PositionSlice {
  position: string;
  name: string;
  count: number;
}

export interface InventoryCategorySlice {
  category: string;
  name: string;
  count: number;
}

export interface TeamSquadSlice {
  teamName: string;
  category: string;
  count: number;
}

interface PlayersAndEquipmentCarouselProps {
  positions: PositionSlice[];
  inventoryCategories: InventoryCategorySlice[];
  teamsSquad: TeamSquadSlice[];
  totalActivePlayers: number;
  totalEquipmentQuantity: number;
  locale: string;
}

interface DonutTooltipProps {
  active?: boolean;
  payload?: any[];
  unit: string;
  total: number;
  locale: string;
}

function DonutTooltip({
  active,
  payload,
  unit,
  total,
  locale
}: DonutTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const isAr = locale === "ar";
  const count = Number(data.count ?? 0);
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const fill = payload[0]?.color || payload[0]?.payload?.fill || "#10B981";
  const displayName = data.name || data.position || data.category || "";

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="z-50 min-w-[150px] rounded-xl border border-border bg-card/95 p-2.5 shadow-xl backdrop-blur-md transition-all text-xs"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs"
          style={{ backgroundColor: fill }}
        />
        <span className="font-bold text-foreground truncate max-w-[150px]">
          {displayName}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3 pt-1 border-t border-border/60 font-mono">
        <span className="font-black text-foreground tabular-nums text-sm">
          {count.toLocaleString(locale)}{" "}
          <span className="text-[10px] font-normal text-muted-foreground">{unit}</span>
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
          {pct}%
        </span>
      </div>
    </div>
  );
}

export function PlayersAndEquipmentCarousel({
  positions,
  inventoryCategories,
  teamsSquad,
  totalActivePlayers,
  totalEquipmentQuantity,
  locale
}: PlayersAndEquipmentCarouselProps) {
  const [activeSlide, setActiveSlide] = useState<0 | 1>(0);
  const isAr = locale === "ar";
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  // Auto rotate carousel every 9 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev === 0 ? 1 : 0));
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  const positionColors = [
    { fill: "#DC2626", stroke: "#EF4444", bg: "bg-red-600" },     // Forwards
    { fill: "#F59E0B", stroke: "#FBBF24", bg: "bg-amber-500" },   // Midfielders
    { fill: "#3B82F6", stroke: "#60A5FA", bg: "bg-blue-500" },    // Defenders
    { fill: "#10B981", stroke: "#34D399", bg: "bg-emerald-500" }  // Goalkeepers
  ];

  const inventoryColors = [
    { fill: "#DC2626", bg: "bg-red-600" },
    { fill: "#10B981", bg: "bg-emerald-500" },
    { fill: "#3B82F6", bg: "bg-blue-500" },
    { fill: "#F59E0B", bg: "bg-amber-500" },
    { fill: "#8B5CF6", bg: "bg-purple-500" },
    { fill: "#06B6D4", bg: "bg-cyan-500" }
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between h-full transition-all carousel-no-stroke select-none outline-none focus:outline-none">
      {/* Top Header & Interactive Carousel Switcher */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/60 pb-3 mb-4 gap-2">
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSlide(0)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none ${
              activeSlide === 0
                ? "bg-club-primary text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>{isAr ? "اللاعبين النشطين" : "Effectif Joueurs"}</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                activeSlide === 0 ? "bg-white/20 text-white" : "bg-muted text-foreground"
              }`}
            >
              {totalActivePlayers}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSlide(1)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none ${
              activeSlide === 1
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            <span>{isAr ? "العتاد والمعدات" : "Équipements"}</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                activeSlide === 1 ? "bg-white/20 text-white" : "bg-muted text-foreground"
              }`}
            >
              {totalEquipmentQuantity}
            </span>
          </button>
        </div>

        {/* Carousel Arrow Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveSlide((prev) => (prev === 0 ? 1 : 0))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
            aria-label="Previous"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveSlide((prev) => (prev === 0 ? 1 : 0))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
            aria-label="Next"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Slide 1: ACTIVE PLAYERS TACTICAL DISTRIBUTION */}
      {activeSlide === 0 && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {isAr ? "توزيع اللاعبين حسب المراكز" : "Répartition Tactique"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr ? "توزيع التعداد الأساسي في القوائم" : "Positionnement sur le terrain"}
              </p>
            </div>
            <Link
              href={`/${locale}/dashboard/players`}
              className="text-xs font-semibold text-club-primary hover:underline flex items-center gap-1"
            >
              <span>{isAr ? "إدارة اللاعبين" : "Gérer"}</span>
              <Arrow className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center my-auto py-2">
            {/* Donut Chart */}
            <div dir="ltr" className="sm:col-span-6 h-56 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={positions}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={84}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {positions.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.position}`}
                        fill={positionColors[index % positionColors.length]?.fill}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    wrapperStyle={{ zIndex: 60, pointerEvents: "none" }}
                    content={
                      <DonutTooltip
                        unit={isAr ? "لاعب" : "joueurs"}
                        total={totalActivePlayers}
                        locale={locale}
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total Badge */}
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black font-mono tabular-nums text-foreground">
                  {totalActivePlayers}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                  {isAr ? "لاعب نشط" : "Actifs"}
                </span>
              </div>
            </div>

            {/* Position Legend & Team Counts */}
            <div className="sm:col-span-6 space-y-2">
              {positions.map((pos, idx) => {
                const color = positionColors[idx % positionColors.length]!;
                const pct = totalActivePlayers > 0 ? Math.round((pos.count / totalActivePlayers) * 100) : 0;
                return (
                  <div
                    key={pos.position}
                    className="flex items-center justify-between rounded-xl bg-muted/40 p-2 text-xs border border-border/40 hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${color.bg}`} />
                      <span className="font-semibold text-foreground">{pos.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground tabular-nums">
                        {pos.count}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Teams breakdown badge row */}
          {teamsSquad.length > 0 && (
            <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{isAr ? "التوزيع حسب الفئات:" : "Effectif par catégorie :"}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {teamsSquad.map((tm) => (
                  <span
                    key={tm.teamName}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground border border-border/50"
                  >
                    <span>{tm.teamName}</span>
                    <span className="font-mono font-bold text-club-primary">({tm.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slide 2: CLUB EQUIPMENT & INVENTORY DISTRIBUTION */}
      {activeSlide === 1 && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {isAr ? "مخزون وعتاد النادي" : "Inventaire & Équipements"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr ? "إجمالي الكرات، الأطقم والمعدات الرياضية" : "Matériel d'entraînement et matchs"}
              </p>
            </div>
            <Link
              href={`/${locale}/dashboard/inventory`}
              className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
            >
              <span>{isAr ? "سجل العتاد" : "Inventaire"}</span>
              <Arrow className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center my-auto py-2">
            {/* Equipment Donut Chart */}
            <div dir="ltr" className="sm:col-span-6 h-56 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={inventoryCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={84}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {inventoryCategories.map((entry, index) => (
                      <Cell
                        key={`cell-inv-${entry.category}`}
                        fill={inventoryColors[index % inventoryColors.length]?.fill}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    wrapperStyle={{ zIndex: 60, pointerEvents: "none" }}
                    content={
                      <DonutTooltip
                        unit={isAr ? "قطعة" : "unités"}
                        total={totalEquipmentQuantity}
                        locale={locale}
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total Badge */}
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black font-mono tabular-nums text-foreground">
                  {totalEquipmentQuantity}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                  {isAr ? "إجمالي القطع" : "Pièces"}
                </span>
              </div>
            </div>

            {/* Inventory List Breakdown */}
            <div className="sm:col-span-6 space-y-2">
              {inventoryCategories.slice(0, 4).map((cat, idx) => {
                const color = inventoryColors[idx % inventoryColors.length]!;
                const pct = totalEquipmentQuantity > 0 ? Math.round((cat.count / totalEquipmentQuantity) * 100) : 0;
                return (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between rounded-xl bg-muted/40 p-2 text-xs border border-border/40 hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${color.bg}`} />
                      <span className="font-semibold text-foreground truncate max-w-[120px]">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground tabular-nums">
                        {cat.count}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>{isAr ? "جاهزية العتاد للمباريات والتدريبات:" : "État général du matériel :"}</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isAr ? "100% جاهز ومطابق" : "100% Opérationnel"}</span>
            </span>
          </div>
        </div>
      )}

      {/* Carousel Footer dots */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setActiveSlide(0)}
          className={`h-2 rounded-full transition-all cursor-pointer ${
            activeSlide === 0 ? "w-6 bg-club-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
          }`}
          aria-label="Slide 1"
        />
        <button
          type="button"
          onClick={() => setActiveSlide(1)}
          className={`h-2 rounded-full transition-all cursor-pointer ${
            activeSlide === 1 ? "w-6 bg-emerald-600" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
          }`}
          aria-label="Slide 2"
        />
      </div>
    </div>
  );
}
