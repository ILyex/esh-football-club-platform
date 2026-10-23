"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Users,
  ShieldAlert,
  Activity,
  HeartPulse,
  Briefcase,
  Layers,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Award
} from "lucide-react";
import {
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

export interface StaffChartMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  team?: {
    id: string;
    category: string;
    name: string;
  } | null;
}

export interface StaffThematicChartsProps {
  staff: StaffChartMember[];
  locale: string;
}

export function StaffThematicCharts({ staff, locale }: StaffThematicChartsProps) {
  const isAr = locale === "ar";
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Partition staff members into the 3 core functional divisions
  const { coachingStaff, medicalStaff, technicalAdminStaff } = useMemo(() => {
    const coaching: StaffChartMember[] = [];
    const medical: StaffChartMember[] = [];
    const technicalAdmin: StaffChartMember[] = [];

    const COACHING_ROLES = new Set([
      "HEAD_COACH",
      "ASSISTANT_COACH",
      "GOALKEEPING_COACH",
      "FITNESS_COACH"
    ]);

    for (const member of staff) {
      if (COACHING_ROLES.has(member.role)) {
        coaching.push(member);
      } else if (member.role === "MEDICAL_STAFF") {
        medical.push(member);
      } else {
        technicalAdmin.push(member);
      }
    }

    return {
      coachingStaff: coaching,
      medicalStaff: medical,
      technicalAdminStaff: technicalAdmin
    };
  }, [staff]);

  // Role labels
  const roleLabels: Record<string, string> = useMemo(
    () => ({
      HEAD_COACH: isAr ? "المدرب الرئيسي" : "Entraîneur",
      ASSISTANT_COACH: isAr ? "المدرب المساعد" : "Entraîneur Adjoint",
      GOALKEEPING_COACH: isAr ? "مدرب الحراس" : "Entraîneur des Gardiens",
      FITNESS_COACH: isAr ? "مدرب اللياقة" : "Préparateur Physique",
      MEDICAL_STAFF: isAr ? "الطاقم الطبي" : "Staff Médical",
      ADMINISTRATIVE_STAFF: isAr ? "الطاقم الإداري" : "Staff Administratif",
      OTHER: isAr ? "مهام الدعم الفني" : "Support & Logistique"
    }),
    [isAr]
  );

  const categoryLabels: Record<string, string> = useMemo(
    () => ({
      SENIOR: isAr ? "الأكابر" : "Séniors",
      U20: isAr ? "فئة U20" : "U20",
      U17: isAr ? "فئة U17" : "U17",
      U15: isAr ? "فئة U15" : "U15",
      GLOBAL: isAr ? "عام للنادي" : "Général Club"
    }),
    [isAr]
  );

  // Grouping helper for chart breakdown
  const buildRoleBreakdown = useCallback((list: StaffChartMember[], filterCat: string) => {
    const filtered =
      filterCat === "ALL"
        ? list
        : list.filter((m) => (m.team?.category || "GLOBAL") === filterCat);

    const counts: Record<string, number> = {};
    for (const m of filtered) {
      counts[m.role] = (counts[m.role] || 0) + 1;
    }

    return Object.entries(counts).map(([role, count]) => ({
      roleKey: role,
      name: roleLabels[role] || role,
      count
    }));
  }, [roleLabels]);

  const coachingData = useMemo(
    () => buildRoleBreakdown(coachingStaff, selectedCategory),
    [coachingStaff, selectedCategory, buildRoleBreakdown]
  );

  const medicalData = useMemo(
    () => buildRoleBreakdown(medicalStaff, selectedCategory),
    [medicalStaff, selectedCategory, buildRoleBreakdown]
  );

  const technicalAdminData = useMemo(
    () => buildRoleBreakdown(technicalAdminStaff, selectedCategory),
    [technicalAdminStaff, selectedCategory, buildRoleBreakdown]
  );

  // Team Category distribution counts
  const categorySummary = useMemo(() => {
    const categories = ["SENIOR", "U20", "U17", "U15", "GLOBAL"];
    return categories.map((cat) => {
      const cCount = coachingStaff.filter((m) => (m.team?.category || "GLOBAL") === cat).length;
      const mCount = medicalStaff.filter((m) => (m.team?.category || "GLOBAL") === cat).length;
      const aCount = technicalAdminStaff.filter((m) => (m.team?.category || "GLOBAL") === cat).length;
      return {
        categoryKey: cat,
        label: categoryLabels[cat] || cat,
        coaching: cCount,
        medical: mCount,
        admin: aCount,
        total: cCount + mCount + aCount
      };
    });
  }, [coachingStaff, medicalStaff, technicalAdminStaff, categoryLabels]);

  return (
    <div className="space-y-4 mb-6">
      {/* Category Filter Pills for Thematic Breakdown */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-club-primary" />
          <span className="text-xs font-bold text-foreground">
            {isAr ? "توزيع الطواقم حسب الفئة الرياضية:" : "Répartition par catégorie :"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              selectedCategory === "ALL"
                ? "bg-club-primary text-white shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
            }`}
          >
            {isAr ? "جميع الفئات الإجمالية" : "Toutes catégories"}
          </button>
          {["SENIOR", "U20", "U17", "U15"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-club-primary text-white shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
              }`}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* 3 Thematic Cards / Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ============================================================== */}
        {/* 1. Coaching Staff (الثيم الأخضر الرياضي - Athletic Emerald) */}
        {/* ============================================================== */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/5 via-card to-card p-4 shadow-2xs hover:border-emerald-500/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 end-0 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isAr ? "طاقم التدريب الفني" : "Staff Technique & Entraîneurs"}
                  </h3>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {isAr ? "المدربين والمعدين البدنيين" : "Entraîneurs & Préparateurs"}
                  </span>
                </div>
              </div>
              <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                {coachingStaff.length}
              </span>
            </div>

            {/* Visual breakdown list */}
            <div className="mt-3 space-y-2">
              {coachingData.length > 0 ? (
                coachingData.map((d) => (
                  <div key={d.roleKey} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground/90">{d.name}</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{d.count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-emerald-950/10 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(15, (d.count / (coachingStaff.length || 1)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground italic">
                  {isAr ? "لا يوجد مدربون مسجلون في هذه الفئة" : "Aucun entraîneur dans cette catégorie"}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{isAr ? "القيادة الميدانية والتكتيكية" : "Tactique & Performance"}</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {Math.round((coachingStaff.length / (staff.length || 1)) * 100)}% {isAr ? "من الطاقم" : "du staff"}
            </span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. Medical Staff (الثيم الأزرق الطبي - Clinical Sky/Cyan) */}
        {/* ============================================================== */}
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-b from-sky-500/5 via-card to-card p-4 shadow-2xs hover:border-sky-500/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 end-0 h-28 w-28 rounded-full bg-sky-500/10 blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold shadow-xs">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isAr ? "الطاقم الطبي والتأهيل" : "Staff Médical & Soins"}
                  </h3>
                  <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                    {isAr ? "الاطباء و الممرضين" : "Médecins & Infirmiers"}
                  </span>
                </div>
              </div>
              <span className="text-xl font-black font-mono text-sky-600 dark:text-sky-400 tabular-nums">
                {medicalStaff.length}
              </span>
            </div>

            {/* Visual breakdown list */}
            <div className="mt-3 space-y-2">
              {medicalData.length > 0 ? (
                medicalData.map((d) => (
                  <div key={d.roleKey} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground/90">{d.name}</span>
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{d.count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-sky-950/10 dark:bg-sky-900/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(20, (d.count / (medicalStaff.length || 1)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground italic">
                  {isAr ? "لا يوجد أطباء مسجلون في هذه الفئة" : "Aucun médecin dans cette catégorie"}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{isAr ? "الرعاية الصحية ومتابعة الإصابات" : "Santé & Rééducation"}</span>
            <span className="font-bold text-sky-600 dark:text-sky-400">
              {Math.round((medicalStaff.length / (staff.length || 1)) * 100)}% {isAr ? "من الطاقم" : "du staff"}
            </span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. Technical & Admin Staff (الثيم البنفسجي الإداري - Royal Violet) */}
        {/* ============================================================== */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/25 bg-gradient-to-b from-purple-500/5 via-card to-card p-4 shadow-2xs hover:border-purple-500/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 end-0 h-28 w-28 rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold shadow-xs">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isAr ? "الطاقم الإداري واللوجستي" : "Staff Administratif & Support"}
                  </h3>
                  <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">
                    {isAr ? "الإداريين و الأمناء" : "Administrateurs & Secrétaires"}
                  </span>
                </div>
              </div>
              <span className="text-xl font-black font-mono text-purple-600 dark:text-purple-400 tabular-nums">
                {technicalAdminStaff.length}
              </span>
            </div>

            {/* Visual breakdown list */}
            <div className="mt-3 space-y-2">
              {technicalAdminData.length > 0 ? (
                technicalAdminData.map((d) => (
                  <div key={d.roleKey} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground/90">{d.name}</span>
                      <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{d.count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-purple-950/10 dark:bg-purple-900/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(20, (d.count / (technicalAdminStaff.length || 1)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground italic">
                  {isAr ? "لا يوجد إداريون مسجلون في هذه الفئة" : "Aucun administratif dans cette catégorie"}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{isAr ? "التنظيم والملفات والعمليات" : "Opérations & Support"}</span>
            <span className="font-bold text-purple-600 dark:text-purple-400">
              {Math.round((technicalAdminStaff.length / (staff.length || 1)) * 100)}% {isAr ? "من الطاقم" : "du staff"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
