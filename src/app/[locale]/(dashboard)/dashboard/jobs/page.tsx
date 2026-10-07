import { requirePagePermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { retryJobAction, cancelJobAction } from "./actions";
import { SettingsNavTabs } from "@/components/settings/settings-nav-tabs";
import { RotateCcw, XCircle, Clock, CheckCircle2, AlertTriangle, Cpu } from "lucide-react";

const STATUS_LABELS: Record<string, { ar: string; fr: string }> = {
  QUEUED: { ar: "قيد الانتظار", fr: "En attente" },
  RUNNING: { ar: "قيد التشغيل", fr: "En cours" },
  SUCCEEDED: { ar: "نجحت", fr: "Succès" },
  RETRYING: { ar: "إعادة المحاولة", fr: "Nouvel essai" },
  FAILED: { ar: "فشلت", fr: "Échouée" },
  CANCELLED: { ar: "ملغاة", fr: "Annulée" }
};

const STATUS_STYLES: Record<string, string> = {
  QUEUED: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  RUNNING: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  RETRYING: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  SUCCEEDED: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  FAILED: "border-red-500/25 bg-red-500/10 text-red-300",
  CANCELLED: "border-border bg-muted/40 text-muted-foreground"
};

const TYPE_LABELS: Record<string, { ar: string; fr: string }> = {
  "gmail.sync": { ar: "مزامنة البريد الإلكتروني", fr: "Synchronisation des e-mails" },
  "insights.sync": { ar: "تحديث التنبيهات والمؤشرات", fr: "Mise à jour des alertes et indicateurs" },
  "notification.dispatch": { ar: "إرسال إشعار", fr: "Envoi d’une notification" },
  "faf.sync": { ar: "مزامنة بيانات الاتحاد", fr: "Synchronisation des données FAF" },
  "faf.keepalive": { ar: "التحقق من جلسة الاتحاد", fr: "Vérification de la session FAF" },
  "faf.match_sync": { ar: "مزامنة وثائق المباراة", fr: "Synchronisation des documents du match" }
};

function formatJobDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-ca-gregory-nu-latn" : "fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatJobClock(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

export default async function BackgroundJobsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePagePermission("settings.manage", locale);
  const isAr = locale === "ar";
  const now = new Date();

  const [jobs, queuedCount, retryingCount, runningCount, staleRunningCount, failedCount, succeededCount] = await Promise.all([
    db.backgroundJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    db.backgroundJob.count({ where: { status: "QUEUED" } }),
    db.backgroundJob.count({ where: { status: "RETRYING" } }),
    db.backgroundJob.count({ where: { status: "RUNNING", lockedUntil: { gt: now } } }),
    db.backgroundJob.count({
      where: { status: "RUNNING", OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] }
    }),
    db.backgroundJob.count({ where: { status: "FAILED" } }),
    db.backgroundJob.count({ where: { status: "SUCCEEDED" } })
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4">
      <SettingsNavTabs locale={locale} />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary">
              <Cpu className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {isAr ? "المهام الخلفية ومعالجة البيانات" : "Tâches d'arrière-plan & File d'attente"}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isAr
            ? "عرض حالة المهام الفعلية وإعادة تشغيل الفاشلة أو إلغاء المعلّقة. يعالجها العامل الخلفي أو خدمة الجدولة عند تشغيلها."
              : "Suivez les tâches réelles, relancez les échecs ou annulez celles en attente. Le worker ou le planificateur doit être actif pour les traiter."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {[
            { label: isAr ? "قيد الانتظار" : "En attente", count: queuedCount + retryingCount + staleRunningCount, Icon: Clock, tone: "border-sky-500/20 bg-sky-500/5 text-sky-700 dark:text-sky-300", iconTone: "bg-sky-500/10 text-sky-600 dark:text-sky-300" },
            { label: isAr ? "قيد التنفيذ" : "En cours", count: runningCount, Icon: AlertTriangle, tone: "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300", iconTone: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
            { label: isAr ? "فشلت" : "Échouées", count: failedCount, Icon: XCircle, tone: "border-destructive/20 bg-destructive/5 text-destructive", iconTone: "bg-destructive/10 text-destructive" },
            { label: isAr ? "ناجحة" : "Réussies", count: succeededCount, Icon: CheckCircle2, tone: "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300", iconTone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" }
          ].map(({ label, count, Icon, tone, iconTone }) => (
            <div key={label} className={`flex min-h-[4.5rem] min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-3 shadow-2xs sm:gap-3 sm:px-4 ${tone}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 text-end">
                <p className="truncate text-[11px] font-semibold text-muted-foreground sm:text-xs">{label}</p>
                <p className="mt-0.5 font-mono text-lg font-bold leading-none tabular-nums text-foreground">{count}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[960px] text-start text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="p-3.5 text-start">{isAr ? "معرّف المهمة / النوع" : "ID / Type"}</th>
              <th className="p-3.5 text-start">{isAr ? "الحالة" : "Statut"}</th>
              <th className="p-3.5 text-start">{isAr ? "المحاولات" : "Tentatives"}</th>
              <th className="p-3.5 text-start">{isAr ? "التوقيت المجدول" : "Planifié / Démarré"}</th>
              <th className="p-3.5 text-start">{isAr ? "تفاصيل الخطأ" : "Erreur"}</th>
              <th className="p-3.5 text-center">{isAr ? "الإجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map((job) => {
              const statusLabel = STATUS_LABELS[job.status]?.[isAr ? "ar" : "fr"] ?? job.status;
              const leaseExpired = job.status === "RUNNING" && (!job.lockedUntil || job.lockedUntil <= now);
              const visibleStatusLabel = leaseExpired
                ? (isAr ? "انتهى الحجز · بانتظار الاستعادة" : "Bail expiré · reprise en attente")
                : statusLabel;
              const typeLabel = TYPE_LABELS[job.type]?.[isAr ? "ar" : "fr"] ?? job.type;
              const activityTime = job.status === "RUNNING"
                ? job.startedAt
                : job.status === "RETRYING"
                  ? job.nextRetryAt
                  : job.status === "SUCCEEDED"
                    ? job.completedAt
                    : job.status === "FAILED"
                      ? job.failedAt
                      : job.status === "CANCELLED"
                        ? job.completedAt
                        : null;
              const activityLabel = job.status === "RUNNING"
                ? (isAr ? "بدأ التنفيذ" : "Démarré")
                : job.status === "RETRYING"
                  ? (isAr ? "المحاولة التالية" : "Prochaine tentative")
                  : job.status === "SUCCEEDED"
                    ? (isAr ? "اكتمل" : "Terminé")
                    : job.status === "FAILED"
                      ? (isAr ? "فشل" : "Échec")
                      : job.status === "CANCELLED"
                        ? (isAr ? "أُلغي" : "Annulé")
                        : null;

              return (
                <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3.5">
                    <div className="text-xs font-bold text-foreground">{typeLabel}</div>
                    <div className="break-all font-mono text-[10px] text-muted-foreground" dir="ltr">{job.type} · {job.id}</div>
                  </td>
                  <td className="p-3.5">
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${leaseExpired ? "border-amber-500/25 bg-amber-500/10 text-amber-300" : STATUS_STYLES[job.status] ?? "border-border bg-muted/40 text-muted-foreground"}`}>
                      {visibleStatusLabel}
                    </span>
                  </td>
                  <td className="p-3.5 text-xs font-mono font-medium tabular-nums" dir="ltr">
                    {job.attempts} / {job.maxAttempts}
                  </td>
                  <td className="p-3.5 text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="shrink-0">{isAr ? "موعد التنفيذ" : "Planifié"}</span>
                      <time dateTime={job.scheduledAt.toISOString()} dir="ltr" className="inline-flex flex-wrap items-center gap-x-2 font-mono tabular-nums text-foreground">
                        <span className="whitespace-nowrap">{formatJobDate(job.scheduledAt, locale)}</span>
                        <span className="whitespace-nowrap text-muted-foreground">{formatJobClock(job.scheduledAt, locale)}</span>
                      </time>
                    </div>
                    {activityTime && <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="shrink-0 text-[10px]">{activityLabel}</span>
                      <time dateTime={activityTime.toISOString()} dir="ltr" className="inline-flex flex-wrap items-center gap-x-2 font-mono text-[10px] tabular-nums">
                        <span className="whitespace-nowrap">{formatJobDate(activityTime, locale)}</span>
                        <span className="whitespace-nowrap">{formatJobClock(activityTime, locale)}</span>
                      </time>
                    </div>}
                    {job.lockedUntil && job.status === "RUNNING" && <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-amber-500">
                      <span className="shrink-0 text-[10px]">{isAr ? "ينتهي الحجز" : "Fin du verrou"}</span>
                      <time dateTime={job.lockedUntil.toISOString()} dir="ltr" className="inline-flex flex-wrap items-center gap-x-2 font-mono text-[10px] tabular-nums">
                        <span className="whitespace-nowrap">{formatJobDate(job.lockedUntil, locale)}</span>
                        <span className="whitespace-nowrap">{formatJobClock(job.lockedUntil, locale)}</span>
                      </time>
                    </div>}
                  </td>
                  <td className="max-w-xs truncate p-3.5 text-xs text-destructive" title={job.lastError ?? ""}>
                    {job.lastError ? job.lastError.slice(0, 80) : "—"}
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {(job.status === "FAILED" || job.status === "CANCELLED") && (
                        <form
                          action={async () => {
                            "use server";
                            await retryJobAction(job.id);
                          }}
                        >
                          <Button size="sm" variant="outline" type="submit" className="h-8 gap-1 rounded-lg text-xs">
                            <RotateCcw className="h-3 w-3" />
                            <span>{isAr ? "إعادة المحاولة" : "Réessayer"}</span>
                          </Button>
                        </form>
                      )}
                      {(job.status === "QUEUED" || job.status === "RETRYING") && (
                        <form
                          action={async () => {
                            "use server";
                            await cancelJobAction(job.id);
                          }}
                        >
                          <Button size="sm" variant="destructive" type="submit" className="h-8 gap-1 rounded-lg text-xs">
                            <XCircle className="h-3 w-3" />
                            <span>{isAr ? "إلغاء المهمة" : "Annuler"}</span>
                          </Button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-sm text-muted-foreground">
                  {isAr ? "لا توجد مهام مسجلة حتى الآن." : "Aucune tâche enregistrée pour le moment."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
