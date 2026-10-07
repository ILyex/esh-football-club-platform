"use client";

import { useState } from "react";
import {
  Search,
  FileBarChart,
  Calendar,
  Layers,
  Users,
  Trophy,
  ClipboardList,
  FileText,
  BarChart3,
  Filter
} from "lucide-react";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";
import { DashboardTeamCategorySelect } from "@/components/shared/dashboard-team-category-select";
import { ReportPrintModal, ReportItemData } from "./report-print-modal";
import { ReportBarChart, ReportPieChart } from "@/components/shared/report-charts";

interface ReportsClientHubProps {
  locale: string;
  reportsList: ReportItemData[];
  departments: Array<{ id: string; label: string }>;
  teamFilter: {
    value: string;
    options: Array<{ id: string; label: string }>;
    allLabel: string;
    canSelectAll: boolean;
  };
  chartsData: {
    playersByPosition: Array<{ label: string; value: number }>;
    playersByTeam: Array<{ label: string; value: number }>;
    staffByRole: Array<{ label: string; value: number }>;
    matchesDistribution: Array<{ label: string; value: number }>;
    contractsByStatus: Array<{ label: string; value: number }>;
    attendanceByStatus: Array<{ label: string; value: number }>;
    documentsByCategory: Array<{ label: string; value: number }>;
  };
}

export function ReportsClientHub({
  locale,
  reportsList,
  departments,
  teamFilter,
  chartsData
}: ReportsClientHubProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const isAr = locale === "ar";

  const filteredReports = reportsList.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === "ALL" || r.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-8">
      {/* ── Search & Filter Bar ── */}
      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-xs">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative min-w-0">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? "ابحث في التقارير..." : "Rechercher un rapport..."}
              className="w-full rounded-xl border border-border bg-background ps-9 pe-3 py-2 text-sm focus:border-club-primary focus:ring-1 focus:ring-club-primary"
            />
          </div>

          <form method="get" className="flex min-w-0 flex-wrap items-center gap-2">
            <DashboardTeamCategorySelect
              value={teamFilter.value}
              options={teamFilter.options}
              allLabel={teamFilter.allLabel}
              canSelectAll={teamFilter.canSelectAll}
              locale={locale}
              label={isAr ? "نطاق الفئة:" : "Catégorie :"}
            />
            <button type="submit" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:border-club-primary/50 hover:bg-muted">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              {isAr ? "تصفية" : "Filtrer"}
            </button>
          </form>
          <div className="flex min-w-0 items-center gap-3 lg:col-span-2">
            <MasterFilterSelect
              label={isAr ? "القسم:" : "Pôle:"}
              locale={isAr ? "ar" : "fr"}
              value={selectedDept}
              options={departments}
              onChange={setSelectedDept}
              headerTitle={isAr ? "تصفية حسب القسم الإداري" : "Filtrer par pôle"}
            />
          </div>
        </div>
      </div>

      {/* Live report snapshots */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-club-primary/10 text-club-primary">
              <FileBarChart className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold text-foreground">
              {isAr ? "ملخصات البيانات القابلة للطباعة" : "Synthèses de données à imprimer"}
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted border border-border/80 text-muted-foreground [font-family:Arial,sans-serif]">
            {filteredReports.length} {isAr ? "تقرير متاح" : "rapports"}
          </span>
        </div>

        {filteredReports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            <FileBarChart className="mx-auto h-12 w-12 opacity-30 mb-2" />
            <p className="text-sm font-semibold">{isAr ? "لا توجد تقارير مطابقة لمعايير البحث" : "Aucun rapport trouvé"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report) => (
              <div
                key={report.title}
                className="group flex min-w-0 flex-col justify-between rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs transition-colors hover:border-club-primary/50"
              >
                <div>
                  <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <span className="max-w-full rounded-lg bg-club-primary/10 px-2.5 py-1 text-xs font-bold text-club-primary">
                      {report.department}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-muted-foreground [font-family:Arial,sans-serif]">
                      <Calendar className="h-3.5 w-3.5" />
                      {report.date}
                    </span>
                  </div>

                  <h3 className="mb-1.5 break-words text-base font-bold text-foreground transition-colors group-hover:text-club-primary">
                    {report.title}
                  </h3>

                  <p className="mb-4 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {report.summary}
                  </p>

                  <p className="mb-3 text-[11px] text-muted-foreground">
                    {isAr ? "النطاق:" : "Périmètre :"} {report.scope}
                  </p>

                  {/* Indicators Preview Box */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60 mb-4">
                    {report.stats.slice(0, 2).map((s, sIdx) => (
                      <div key={sIdx} className="bg-muted/40 rounded-xl p-2.5 text-center border border-border/40">
                        <span className="block text-[11px] text-muted-foreground truncate">{s.label}</span>
                        <span className="text-sm font-bold [font-family:Arial,sans-serif] text-foreground mt-0.5 block truncate">
                          {s.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <span className="inline-block h-2 w-2 rounded-full bg-club-primary" />
                    <span>{isAr ? "مستخرج من بيانات المنصة" : "Extrait des données de la plateforme"}</span>
                  </span>
                  <ReportPrintModal report={report} locale={locale} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Re-architected Visual Analytics & Charts Section ── */}
      <section className="space-y-5 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-club-primary/10 text-club-primary">
                <BarChart3 className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold text-foreground">
                {isAr ? "المخططات البيانية والأعمدة الإحصائية" : "Indicateurs Graphiques & Histogrammes"}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr
                ? "قراءة بصرية متقدمة لمؤشرات النادي الفنية، الرياضية، التعاقدية والأرشيفية"
                : "Analyse visuelle avancée des effectifs, résultats sportifs et archives"}
            </p>
          </div>

          {/* Section Subtitle */}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Chart 1: Players by Position */}
          <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between sm:p-6">
            <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-club-primary" />
                <h3 className="min-w-0 break-words text-sm font-bold text-foreground">
                  {isAr ? "توزيع اللاعبين حسب المراكز التكتيكية" : "Répartition par poste tactique"}
                </h3>
              </div>
            </div>
            <ReportBarChart data={chartsData.playersByPosition} locale={locale} />
          </div>

          {/* Chart 2: Active staff by role */}
          <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between sm:p-6">
            <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-border/80 pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-sky-500" />
                <h3 className="min-w-0 break-words text-sm font-bold text-foreground">
                  {isAr ? "أعضاء الطاقم النشطون حسب المهمة" : "Membres actifs du staff par fonction"}
                </h3>
              </div>
            </div>
            <ReportBarChart data={chartsData.staffByRole} horizontal locale={locale} />
          </div>

          {/* Chart 3: Players by Category */}
          <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between sm:p-6">
            <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-600" />
                <h3 className="min-w-0 break-words text-sm font-bold text-foreground">
                  {isAr ? "تعداد اللاعبين حسب الفئات السنية" : "Effectifs par catégorie d'âge"}
                </h3>
              </div>
            </div>
            <ReportBarChart data={chartsData.playersByTeam} horizontal locale={locale} />
          </div>

          {/* Chart 4: Matches Distribution (Donut) */}
          <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between sm:p-6">
            <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h3 className="min-w-0 break-words text-sm font-bold text-foreground">
                  {isAr ? "نتائج المباريات المنتهية بنتيجة مسجلة" : "Résultats des matchs avec score enregistré"}
                </h3>
              </div>
            </div>
            {chartsData.matchesDistribution.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                {isAr ? "لا توجد مباريات مسجلة حالياً" : "Aucun match"}
              </div>
            ) : (
              <ReportPieChart data={chartsData.matchesDistribution} locale={locale} />
            )}
          </div>

          {/* Chart 5: Contracts by Status */}
          <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between sm:p-6">
            <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-sky-500" />
                <h3 className="min-w-0 break-words text-sm font-bold text-foreground">
                  {isAr ? "حالات عقود اللاعبين والطواقم" : "État de validité des contrats"}
                </h3>
              </div>
            </div>
            <ReportBarChart data={chartsData.contractsByStatus} locale={locale} />
          </div>

          {/* Chart 6: Training Attendance */}
          <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between sm:p-6">
            <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500" />
                <h3 className="min-w-0 break-words text-sm font-bold text-foreground">
                  {isAr ? "سجلات الحضور حسب الحالة" : "Pointages par statut"}
                </h3>
              </div>
            </div>
            {chartsData.attendanceByStatus.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                {isAr ? "لا توجد سجلات تدريب" : "Aucun enregistrement"}
              </div>
            ) : (
              <ReportBarChart data={chartsData.attendanceByStatus} locale={locale} />
            )}
          </div>

          {/* Chart 7: Documents by Category */}
          <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between sm:p-6">
            <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <h3 className="min-w-0 break-words text-sm font-bold text-foreground">
                  {isAr ? "توزيع وثائق الأرشيف الرقمي حسب التصنيف" : "Archives numériques par catégorie"}
                </h3>
              </div>
            </div>
            <ReportBarChart data={chartsData.documentsByCategory} horizontal locale={locale} />
          </div>
        </div>
      </section>
    </div>
  );
}
