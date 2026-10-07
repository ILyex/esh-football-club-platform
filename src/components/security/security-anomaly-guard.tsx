"use client";

import { Shield, Users, Activity, Lock, AlertTriangle, Info } from "lucide-react";
import type { AnomalyReport } from "@/lib/security/anomaly-detector";

interface SecurityAnomalyGuardProps {
  report: AnomalyReport;
  locale: string;
}

export function SecurityAnomalyGuard({ report, locale }: SecurityAnomalyGuardProps) {
  const isAr = locale === "ar";

  const threatColor =
    report.threatLevel === "NORMAL"
      ? "text-blue-500 bg-blue-500/10 border-blue-500/30"
      : report.threatLevel === "LOW"
      ? "text-blue-500 bg-blue-500/10 border-blue-500/30"
      : report.threatLevel === "INSUFFICIENT_DATA"
      ? "text-slate-500 bg-slate-500/10 border-slate-500/30"
      : report.threatLevel === "HIGH"
      ? "text-orange-500 bg-orange-500/10 border-orange-500/30"
      : "text-red-500 bg-red-500/10 border-red-500/30";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-background p-6 shadow-xl mb-6">
      {/* Background ambient glow */}
      <div className="absolute -top-24 -end-24 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-4 border-b border-border/60 pb-5">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-inner">
            <Shield className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="text-lg font-bold leading-6 tracking-tight text-foreground">
                {isAr ? "درع الرقابة والتحليل الأمني" : "Bouclier de Sécurité & Surveillance"}
              </h2>
              <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-5 ${threatColor}`}>
                {(report.threatLevel === "NORMAL" || report.threatLevel === "LOW" || report.threatLevel === "INSUFFICIENT_DATA") && <Info className="h-3 w-3" />}
                {(report.threatLevel === "HIGH" || report.threatLevel === "CRITICAL") && (
                  <AlertTriangle className="h-3 w-3" />
                )}
                <span>
                  {isAr ? `مستوى الخطر: ${report.threatLevelLabelAr}` : `Niveau: ${report.threatLevelLabelFr}`}
                </span>
              </span>
            </div>
            <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
              {isAr
                ? "مراجعة قواعد لأحداث سجل التدقيق المتاحة؛ ليست مراقبة شاملة أو تقييماً معتمداً لمستوى الأمان."
                : "Analyse par règles des événements d'audit disponibles ; ce n'est ni une surveillance complète ni une certification de sécurité."}
            </p>
          </div>
        </div>

        <div className="flex max-w-full shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-xs leading-5 text-muted-foreground sm:max-w-xs">
          <Lock className="h-4 w-4" />
          {isAr ? "تصنيف آلي أولي، راجع الأحداث قبل التصرف" : "Signal indicatif ; examiner les événements avant d'agir"}
        </div>
      </div>

      {/* Explicit Classification Reason Banner */}
      <div className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-3.5 flex items-start gap-3">
        <Info className="h-4 w-4 text-club-primary shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-bold text-foreground">
            {isAr ? "سبب تصنيف مستوى الخطر:" : "Motif de qualification :"}
          </span>{" "}
          <span className="text-muted-foreground">
            {isAr ? report.primaryReasonAr : report.primaryReasonFr}
          </span>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3.5 py-2.5 text-[11px] leading-5 text-muted-foreground">
        {isAr
          ? "طريقة القياس: تُراجع أحداث سجل التدقيق لآخر 24 ساعة. رفض صلاحية واحد يُعرض كحالة متابعة منخفضة؛ لا يصبح التصنيف مرتفعاً إلا مع تكرار الرفض أو اجتماع ذلك مع محاولات دخول فاشلة متكررة."
          : "Méthode : les événements d’audit des dernières 24 h sont examinés. Un seul refus de permission reste un signal de suivi faible ; le niveau élevé exige des refus répétés ou leur combinaison avec des échecs de connexion répétés."}
      </div>

      {report.aiInsight && (
        <div className="mt-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3.5 py-2.5 text-[11px] leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">
            {isAr ? "مراجعة مساعد محلي:" : "Revue assistée locale :"}
          </span>{" "}
          {report.aiInsight.evidence.map((evidence, index) => (
            <span key={evidence}>
              {index > 0 ? (isAr ? "، " : ", ") : ""}
              {isAr
                ? evidence === "FAILED_LOGIN_BURST"
                  ? "تكرار فشل الدخول"
                  : evidence === "REPEATED_AUTH_DENIAL"
                    ? "تكرار رفض الصلاحية"
                    : "رفض صلاحية منفرد"
                : evidence === "FAILED_LOGIN_BURST"
                  ? "échecs de connexion répétés"
                  : evidence === "REPEATED_AUTH_DENIAL"
                    ? "refus d’autorisation répétés"
                    : "refus d’autorisation isolé"}
            </span>
          ))}
          <span className="block mt-1">
            {isAr ? "هذا تلخيص للمؤشرات الموجودة فقط ولا يغيّر التصنيف الآلي." : "Résumé des indicateurs existants uniquement ; le niveau automatique reste inchangé."}
          </span>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 my-5">
        <div className="rounded-xl border border-border/50 bg-background/50 p-3.5 flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            {isAr ? "عمليات آخر 24 ساعة" : "Activité 24h"}
          </span>
          <span className="text-xl font-bold font-mono text-foreground mt-1">
            {report.stats.recentActions24h}
          </span>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/50 p-3.5 flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-amber-500" />
            {isAr ? "رفض الصلاحيات" : "Refus d’autorisation"}
          </span>
          <span className="text-xl font-bold font-mono text-foreground mt-1">
            {report.stats.unauthorizedAttemptsCount}
          </span>
          <span className="text-[10px] text-muted-foreground mt-1">{isAr ? "آخر 24 ساعة" : "Dernières 24 h"}</span>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/50 p-3.5 flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-emerald-500" />
            {isAr ? "الحسابات المفعّلة" : "Comptes activés"}
          </span>
          <span className="text-xl font-bold font-mono text-foreground mt-1">
            {report.stats.enabledAccountsCount}
          </span>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/50 p-3.5 flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            {isAr ? "محاولات دخول غير ناجحة" : "Échecs de connexion"}
          </span>
          <span className="text-xl font-bold font-mono text-foreground mt-1">
            {report.stats.failedAttemptsCount}
          </span>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/50 p-3.5 flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-blue-500" />
            {isAr ? "عمليات حساسة في العينة" : "Actions sensibles observées"}
          </span>
          <span className="text-xl font-bold font-mono text-foreground mt-1">
            {report.stats.sensitiveOperationsCount}
          </span>
        </div>
      </div>

      {/* Dynamic Security Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 my-6 border-t border-border/60 pt-5">
        {/* Chart 1: 24h Activity Distribution */}
        <div className="lg:col-span-7 rounded-xl border border-border/70 bg-card/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500" />
                <span>{isAr ? "توزيع أحداث التدقيق خلال 24 ساعة" : "Répartition des événements d'audit sur 24h"}</span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {isAr ? "الأعمدة تعرض أحدث 1000 حدث كحد أقصى؛ العدد الإجمالي منفصل" : "Graphique limité aux 1 000 événements les plus récents ; total affiché séparément"}
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold bg-muted px-2 py-0.5 rounded border border-border text-foreground">
              {report.stats.recentActions24h} {isAr ? "عملية" : "act."}
            </span>
          </div>

          <div className="pt-2">
            <div className="flex items-end justify-between gap-2 h-28 px-1 pb-1 border-b border-border/80">
              {report.charts.activityByHour.map((bucket, i) => {
                const maxCount = Math.max(1, ...report.charts.activityByHour.map((b) => b.count));
                const heightPercent = Math.round((bucket.count / maxCount) * 100);
                const hasSensitive = bucket.sensitiveCount > 0;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                      {bucket.count}
                    </span>
                    <div className="w-full max-w-[32px] rounded-t-md bg-muted/60 relative overflow-hidden flex flex-col justify-end transition-all group-hover:scale-105" style={{ height: `${heightPercent}%` }}>
                      <div
                        className={`w-full ${hasSensitive ? "bg-amber-500" : "bg-emerald-500"} transition-all`}
                        style={{ height: "100%" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between gap-2 px-1 pt-2">
              {report.charts.activityByHour.map((bucket, i) => (
                <span key={i} className="flex-1 text-center text-[9px] sm:text-[10px] font-mono text-muted-foreground truncate">
                  {bucket.hour.split(" - ")[0]}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 2: Real Operations Category Distribution */}
        <div className="lg:col-span-5 rounded-xl border border-border/70 bg-card/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>{isAr ? "تصنيف العمليات الإدارية" : "Catégories d'Opérations"}</span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
              {isAr ? "توزيع عينة من أحدث 1000 حدث كحد أقصى" : "Répartition des 1 000 événements les plus récents au maximum"}
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {isAr ? "ليست نسبة نزاهة أو مؤشراً أمنياً" : "Aucun score d'intégrité ni taux de sécurité"}
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {report.charts.actionsByType.map((item) => (
              <div key={item.type} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground text-[11px]">
                    {isAr ? item.labelAr : item.labelFr}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground text-[10px]">{item.count}</span>
                    <span className="font-mono font-bold text-foreground text-[10px] w-8 text-end">{item.percentage}%</span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-club-primary transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Anomalies / Security Events list */}
      {report.detectedAnomalies.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {isAr ? "تنبيهات التدقيق والرقابة الأمنية" : "Alertes de Sécurité Récentes"}
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {report.detectedAnomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 rounded-full p-1 shrink-0 ${
                      anomaly.severity === "danger"
                        ? "bg-red-500/20 text-red-500"
                        : anomaly.severity === "warning"
                        ? "bg-amber-500/20 text-amber-500"
                        : "bg-blue-500/20 text-blue-500"
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {isAr ? anomaly.titleAr : anomaly.titleFr}
                    </p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      {isAr ? anomaly.descriptionAr : anomaly.descriptionFr}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Intl.DateTimeFormat(locale, { timeStyle: "short", dateStyle: "short" }).format(
                      new Date(anomaly.timestamp)
                    )}
                  </span>
                  {anomaly.actor && (
                    <p className="text-[10px] font-medium text-foreground/80 mt-0.5">
                      {anomaly.actor}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
