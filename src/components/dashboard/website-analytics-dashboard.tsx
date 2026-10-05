"use client";

import { useState, useEffect, useTransition } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import {
  Users,
  Eye,
  MousePointerClick,
  Activity,
  Globe,
  Share2,
  ExternalLink
} from "lucide-react";
import type { WebsiteAnalyticsData } from "@/lib/analytics";
import { summarizeWebsiteAnalytics } from "@/app/[locale]/(dashboard)/dashboard/website/actions";

interface WebsiteAnalyticsDashboardProps {
  locale: string;
  analytics: WebsiteAnalyticsData;
  publishedNewsCount: number;
  publishedMatchesCount: number;
  albumsCount: number;
  announcementsCount: number;
  latestNews: Array<{
    id: string;
    title: string;
    publishedAt: Date | string;
    category: string | null;
  }>;
  nextMatch: {
    opponent: string;
    matchDate: Date | string;
    stadium: string | null;
    isHomeFixture: boolean;
  } | null;
}

export function WebsiteAnalyticsDashboard({
  locale,
  analytics,
  publishedNewsCount,
  publishedMatchesCount,
  albumsCount,
  announcementsCount,
  latestNews,
  nextMatch
}: WebsiteAnalyticsDashboardProps) {
  const isRtl = locale === "ar";
  const [mounted, setMounted] = useState(false);
  const [trafficMetric, setTrafficMetric] = useState<"visitors" | "pageViews" | "clicks">("visitors");
  const [aiSummary, setAiSummary] = useState("");
  const [aiError, setAiError] = useState("");
  const [isAiPending, startAiTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = analytics.dailyTraffic.map((d) => {
    const parts = d.date.split("-");
    const formatted = `${parts[2]}/${parts[1]}`;
    return {
      date: formatted,
      fullDate: d.date,
      visitors: d.visitors,
      pageViews: d.pageViews,
      clicks: d.clicks
    };
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border/80 bg-cover bg-center p-6 sm:p-8 text-white shadow-lg"
        style={{ backgroundImage: "url('/branding/esh-header-crest.png')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/80 to-black/55 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-0.5 text-xs font-bold text-emerald-400 mb-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isRtl ? "قياس من أحداث فعلية" : "Mesure à partir d’événements réels"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isRtl ? "لوحة حالة وإحصائيات الموقع العام" : "Tableau de Bord & Métriques du Site Public"}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-300 max-w-xl">
              {isRtl
                ? "أرقام الزيارات والنقرات تُحسب من أحداث فعلية بعد تفعيل القياس؛ لا توجد بيانات تاريخية أو تقديرية."
                : "Visites et clics calculés à partir des événements réels depuis l’activation du suivi, sans historique estimé."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/${locale}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition-all backdrop-blur-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>{isRtl ? "فتح الموقع العام" : "Visiter le site public"}</span>
            </a>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold">{isRtl ? "مراجعة ذكية للبيانات المسجلة" : "Analyse locale des données enregistrées"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRtl ? "يلخص الذكاء المحلي المؤشرات الفعلية فقط، ولا ينشئ أرقاماً." : "L’IA locale résume les indicateurs réels sans générer de chiffres."}
            </p>
          </div>
          <button
            type="button"
            disabled={isAiPending || !analytics.hasData}
            onClick={() => startAiTransition(async () => {
              setAiError("");
              const result = await summarizeWebsiteAnalytics();
              if (result.ok) setAiSummary(result.summary);
              else setAiError(result.error);
            })}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAiPending ? (isRtl ? "جارٍ التحليل…" : "Analyse…") : (isRtl ? "حلّل المؤشرات" : "Analyser les indicateurs")}
          </button>
        </div>
        {aiSummary && <p className="mt-4 whitespace-pre-line rounded-xl bg-muted/40 p-4 text-sm leading-7">{aiSummary}</p>}
        {aiError && <p role="status" className="mt-3 text-xs text-amber-700 dark:text-amber-300">{aiError}</p>}
      </section>

      {/* 2. Top Stats Grid (Real-time and Cumulative) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Visitors */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isRtl ? "الزوار الفريدون" : "Visiteurs uniques"}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {analytics.totalVisitors.toLocaleString(locale === "ar" ? "ar-DZ" : "fr-FR")}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isRtl ? "زوار مميزون خلال آخر 14 يوماً" : "Visiteurs distincts sur 14 jours"}
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Page Views */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isRtl ? "إجمالي مشاهدات الصفحات" : "Pages Vues"}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {analytics.totalPageViews.toLocaleString(locale === "ar" ? "ar-DZ" : "fr-FR")}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isRtl
                ? `متوسط ${analytics.totalVisitors ? (analytics.totalPageViews / analytics.totalVisitors).toFixed(1) : "0.0"} صفحة لكل زائر`
                : `Moy. ${analytics.totalVisitors ? (analytics.totalPageViews / analytics.totalVisitors).toFixed(1) : "0.0"} pages / visiteur`}
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Eye className="h-6 w-6" />
          </div>
        </div>

        {/* Total Clicks */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isRtl ? "إجمالي النقرات والتفاعل" : "Clics & Interactions"}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {analytics.totalClicks.toLocaleString(locale === "ar" ? "ar-DZ" : "fr-FR")}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isRtl ? "نقرات على الأخبار، المباريات والروابط" : "Clics sur articles, matchs et liens"}
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <MousePointerClick className="h-6 w-6" />
          </div>
        </div>

        {/* Live Active Visitors Now */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isRtl ? "نشطون خلال آخر 5 دقائق" : "Actifs sur les 5 dernières minutes"}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {analytics.activeNow}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isRtl ? "آخر 5 دقائق" : "5 dernières minutes"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isRtl ? "زوار سُجل لهم عرض صفحة خلال آخر 5 دقائق" : "Visiteurs ayant affiché une page dans les 5 dernières minutes"}
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <Activity className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* 3. Main Chart: Traffic & Interactions Over Time */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              {isRtl ? "حركة زوار الموقع والتفاعل اليومي" : "Évolution du Trafic et de l'Engagement"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRtl ? "أحداث مسجلة فعلياً خلال آخر 14 يوماً (بتوقيت UTC)" : "Événements réellement enregistrés sur les 14 derniers jours (UTC)"}
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="inline-flex rounded-xl border border-border p-1 bg-muted/30">
            <button
              type="button"
              onClick={() => setTrafficMetric("visitors")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                trafficMetric === "visitors"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isRtl ? "الزوار الفريدون" : "Visiteurs"}
            </button>
            <button
              type="button"
              onClick={() => setTrafficMetric("pageViews")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                trafficMetric === "pageViews"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isRtl ? "مشاهدات الصفحات" : "Pages Vues"}
            </button>
            <button
              type="button"
              onClick={() => setTrafficMetric("clicks")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                trafficMetric === "clicks"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isRtl ? "النقرات" : "Clics"}
            </button>
          </div>
        </div>

        {/* Chart Area */}
        <div className="h-72 w-full pt-2">
          {mounted && analytics.hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={
                        trafficMetric === "visitors"
                          ? "#2563eb"
                          : trafficMetric === "pageViews"
                          ? "#8b5cf6"
                          : "#10b981"
                      }
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor={
                        trafficMetric === "visitors"
                          ? "#2563eb"
                          : trafficMetric === "pageViews"
                          ? "#8b5cf6"
                          : "#10b981"
                      }
                      stopOpacity={0.0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/60" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length && payload[0]?.payload) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-xs space-y-1">
                          <p className="font-bold text-foreground border-b border-border pb-1">{data.fullDate}</p>
                          <p className="text-blue-600 dark:text-blue-400 font-medium">
                            {isRtl ? "الزوار:" : "Visiteurs:"} <strong className="font-mono">{data.visitors}</strong>
                          </p>
                          <p className="text-purple-600 dark:text-purple-400 font-medium">
                            {isRtl ? "مشاهدات الصفحات:" : "Pages Vues:"} <strong className="font-mono">{data.pageViews}</strong>
                          </p>
                          <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {isRtl ? "النقرات:" : "Clics:"} <strong className="font-mono">{data.clicks}</strong>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={trafficMetric}
                  stroke={
                    trafficMetric === "visitors"
                      ? "#2563eb"
                      : trafficMetric === "pageViews"
                      ? "#8b5cf6"
                      : "#10b981"
                  }
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#trafficGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : analytics.hasData ? (
            <div className="h-full w-full animate-pulse rounded-xl bg-muted/40" />
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              {isRtl ? "لا توجد بيانات مسجلة بعد. ستظهر الأرقام بعد استقبال زيارات فعلية للموقع." : "Aucune donnée enregistrée. Les statistiques apparaîtront après les premières visites."}
            </div>
          )}
        </div>
      </div>

      {/* 4. Secondary Row: Top Pages & Traffic Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages & Clicks Breakdown */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <span>{isRtl ? "أكثر صفحات الموقع زيارة ونقراً" : "Pages les Plus Visitées"}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isRtl ? "توزيع الزيارات والنقرات حسب أقسام الموقع" : "Répartition du trafic par rubrique"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {analytics.topPages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {isRtl ? "لا توجد زيارات مسجلة بعد." : "Aucune visite enregistrée."}
              </p>
            ) : analytics.topPages.map((page, idx) => {
              const maxViews = analytics.topPages[0]?.views || 1;
              const percent = Math.round((page.views / maxViews) * 100);
              const labelMap: Record<string, string> = {
                "/": isRtl ? "الصفحة الرئيسية" : "Accueil",
                "/matches": isRtl ? "المباريات والنتائج" : "Matchs & Résultats",
                "/news": isRtl ? "الأخبار ومستجدات النادي" : "Actualités",
                "/team": isRtl ? "قائمة الفرق واللاعبين" : "Équipes & Effectif",
                "/gallery": isRtl ? "معرض الصور والألبومات" : "Galerie Photo"
              };

              return (
                <div key={page.path} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-foreground flex items-center gap-1.5 truncate">
                      <span className="font-mono text-muted-foreground w-4">#{idx + 1}</span>
                      <span>{labelMap[page.path] || page.path}</span>
                    </span>
                    <div className="flex items-center gap-3 shrink-0 font-mono">
                      <span className="text-purple-600 dark:text-purple-400">
                        {page.views.toLocaleString()} {isRtl ? "زيارة" : "vues"}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {page.clicks.toLocaleString()} {isRtl ? "نقرة" : "clics"}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-purple-600"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Traffic Sources & Device Distribution */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" />
                <span>{isRtl ? "مصادر الزيارات والأجهزة" : "Sources du Trafic & Appareils"}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isRtl ? "من أين تأتي الجماهير ونوع الجهاز المستخدم" : "Canaux d'acquisition et supports"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
              {isRtl ? "مصادر الإحالة" : "Sources de provenance"}
              </h4>
              <div className="space-y-2">
                {analytics.referrerBreakdown.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">{isRtl ? "لا توجد مصادر مسجلة بعد." : "Aucune source enregistrée."}</p>
                ) : analytics.referrerBreakdown.map((ref) => (
                  <div
                    key={ref.source}
                    className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-foreground">
                      {ref.source === "Direct" ? (isRtl ? "مباشر" : "Direct") : ref.source === "Internal" ? (isRtl ? "تنقل داخلي" : "Navigation interne") : ref.source === "Unknown" ? (isRtl ? "غير معروف" : "Inconnu") : ref.source}
                    </span>
                    <span className="font-mono font-bold text-primary">
                      {ref.visits.toLocaleString()} {isRtl ? "زيارة" : "visites"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border/70">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
                {isRtl ? "توزيع الأجهزة المستخدمة" : "Supports utilisés"}
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {analytics.deviceBreakdown.length === 0 ? (
                  <p className="col-span-3 py-3 text-sm text-muted-foreground">{isRtl ? "لا توجد بيانات أجهزة بعد." : "Aucune donnée sur les appareils."}</p>
                ) : analytics.deviceBreakdown.map((dev) => (
                  <div
                    key={dev.device}
                    className="rounded-xl border border-border/70 bg-muted/15 p-2.5 text-center"
                  >
                    <span className="text-lg font-extrabold text-foreground font-mono">
                      {dev.visits.toLocaleString(locale === "ar" ? "ar-DZ" : "fr-FR")}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {dev.device === "MOBILE" ? (isRtl ? "هاتف" : "Mobile") : dev.device === "TABLET" ? (isRtl ? "جهاز لوحي" : "Tablette") : (isRtl ? "حاسوب" : "Ordinateur")}
                      {` · ${dev.percentage}%`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Published Content Overview (News, Matches, Next Fixture) */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground">
              {isRtl ? "حالة المحتوى المنشور حالياً على الموقع" : "Contenu Publié sur le Site"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRtl ? "نظرة عامة على المقالات الإخبارية، ألبومات الصور، والمباراة القادمة" : "Vue d'ensemble des articles et matchs en ligne"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border p-3.5 bg-muted/15 text-center">
            <span className="text-2xl font-extrabold text-foreground font-mono">{publishedNewsCount}</span>
            <p className="text-xs text-muted-foreground font-semibold mt-1">{isRtl ? "أخبار منشورة" : "Articles publiés"}</p>
          </div>
          <div className="rounded-xl border border-border p-3.5 bg-muted/15 text-center">
            <span className="text-2xl font-extrabold text-foreground font-mono">{publishedMatchesCount}</span>
            <p className="text-xs text-muted-foreground font-semibold mt-1">{isRtl ? "مباريات منشورة" : "Matchs en ligne"}</p>
          </div>
          <div className="rounded-xl border border-border p-3.5 bg-muted/15 text-center">
            <span className="text-2xl font-extrabold text-foreground font-mono">{albumsCount}</span>
            <p className="text-xs text-muted-foreground font-semibold mt-1">{isRtl ? "ألبومات صور" : "Albums photos"}</p>
          </div>
          <div className="rounded-xl border border-border p-3.5 bg-muted/15 text-center">
            <span className="text-2xl font-extrabold text-foreground font-mono">{announcementsCount}</span>
            <p className="text-xs text-muted-foreground font-semibold mt-1">{isRtl ? "إعلانات رسمية" : "Annonces officielles"}</p>
          </div>
        </div>

        {/* Latest news list */}
        {latestNews.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              {isRtl ? "آخر الأخبار المعروضة على الصفحة الرئيسية:" : "Dernières actualités à la une :"}
            </h4>
            <div className="divide-y divide-border/60 rounded-xl border border-border overflow-hidden">
              {latestNews.map((n) => (
                <div key={n.id} className="flex items-center justify-between p-3 hover:bg-muted/20 text-xs">
                  <span className="font-bold text-foreground truncate max-w-md">{n.title}</span>
                  <span className="text-muted-foreground shrink-0 font-mono">
                    {new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-FR", {
                      day: "numeric",
                      month: "short"
                    }).format(new Date(n.publishedAt))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
