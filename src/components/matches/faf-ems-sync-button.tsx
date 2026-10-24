"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, LoaderCircle } from "lucide-react";
import { getMatchBackgroundJobStatusAction, syncFAFMatchDocumentsAction } from "@/app/[locale]/(dashboard)/dashboard/matches/actions";
import { Button } from "@/components/ui/button";

export function FafEmsSyncButton({ matchId, locale, buttonLabel }: { matchId: string; locale: string; buttonLabel?: string }) {
  const [pending, setPending] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobType, setJobType] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [phase, setPhase] = useState("");
  const router = useRouter();
  const ar = locale === "ar";

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const state = await getMatchBackgroundJobStatusAction(jobId, matchId, locale);
        if (cancelled) return;
        setJobType(state.type);
        const statusProgress = state.status === "QUEUED" ? 22 : state.status === "RETRYING" ? 62 : 42;
        setProgress((current) => Math.max(current, statusProgress));
        setPhase(state.type === "match.referee_report_analysis"
          ? (ar ? "جارٍ تحليل التقرير" : "Analyse du rapport en cours")
          : state.status === "QUEUED"
            ? (ar ? "جارٍ تجهيز الاستيراد" : "Préparation de l’import")
            : (ar ? "جارٍ جلب وثائق المباراة" : "Import des documents du match"));

        if (state.status === "SUCCEEDED") {
          if (state.type === "faf.match_sync" && state.followUpJobId) {
            setProgress((current) => Math.max(current, 68));
            setPhase(ar ? "جارٍ تحليل التقرير وربط الأحداث" : "Analyse du rapport et liaison des événements");
            setJobId(state.followUpJobId);
          } else {
            setProgress(100);
            setCompleted(true);
            setJobId(null);
            toast.success(state.type === "match.referee_report_analysis"
              ? (ar ? "اكتمل تحليل المباراة" : "Analyse du match terminée")
              : (ar ? "اكتمل جلب وثائق المباراة" : "Documents du match importés"));
            if (state.warning) toast.warning(ar ? "اكتمل الجلب مع ملاحظات" : "Import terminé avec des remarques");
            router.refresh();
            window.setTimeout(() => {
              setCompleted(false);
              setProgress(0);
              setPhase("");
              setJobType(null);
            }, 1100);
          }
        } else if (["FAILED", "CANCELLED"].includes(state.status)) {
          setJobId(null);
          setCompleted(false);
          setProgress(0);
          const errorTitle = ar ? "تعذر جلب تشكيلة المباراة من FAF EMS." : "Impossible d’importer la composition depuis FAF EMS.";
          const errorDescription = state.error?.trim();
          toast.error(errorTitle, errorDescription ? { description: errorDescription, duration: 10000 } : undefined);
        } else {
          timer = setTimeout(poll, 2500);
        }
      } catch {
        if (cancelled) return;
        setJobId(null);
        setProgress(0);
        toast.error(ar ? "تعذر متابعة جلب الوثائق. أعد المحاولة." : "Impossible de suivre l’import. Réessayez.");
      }
    };
    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [jobId, matchId, locale, ar, router]);

  useEffect(() => {
    if (!pending && !jobId) return;
    const timer = window.setInterval(() => setProgress((current) => Math.min(90, current + 1.5)), 650);
    return () => window.clearInterval(timer);
  }, [pending, jobId]);

  const jobActive = Boolean(jobId);
  const isLoading = pending || jobActive;
  const showProgress = isLoading || completed;

  return <div className="w-full max-w-[32rem] space-y-2">
    <div className="flex justify-end">
      <Button type="button" size="sm" variant="outline" className="min-w-44 justify-center" aria-label={isLoading ? (ar ? "جارٍ جلب بيانات FAF EMS" : "Import FAF EMS en cours") : (buttonLabel || (ar ? "جلب وثائق FAF EMS" : "Importer les documents FAF EMS"))} onClick={async () => {
        setPending(true);
        setCompleted(false);
        setProgress(8);
        setPhase(ar ? "جارٍ الاتصال بـ FAF EMS" : "Connexion à FAF EMS");
        try {
          const result = await syncFAFMatchDocumentsAction(matchId, locale);
          if (!result.success) throw new Error(result.message);
          setProgress((current) => Math.max(current, 20));
          setJobId(result.jobId);
          toast.success(ar ? "بدأ جلب الوثائق" : "Import des documents lancé");
        } catch (error) {
          toast.error(ar ? "تعذر بدء جلب الوثائق. أعد المحاولة." : "Impossible de lancer l’import. Réessayez.");
          setProgress(0);
          setPhase("");
        } finally { setPending(false); }
      }} disabled={pending || jobActive}>
        {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <><Download className="me-2 h-4 w-4" aria-hidden="true" />{buttonLabel || (ar ? "جلب وثائق FAF EMS" : "Importer les documents FAF EMS")}</>}
      </Button>
    </div>
    {showProgress && <div dir={ar ? "rtl" : "ltr"} role="status" aria-live="polite" className="space-y-1.5 rounded-lg border border-border/70 bg-background/70 px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>{phase || (jobType === "match.referee_report_analysis" ? (ar ? "جارٍ تحليل التقرير" : "Analyse du rapport en cours") : (ar ? "جارٍ تنفيذ الطلب" : "Traitement en cours"))}</span>
        <span dir="ltr" className="shrink-0 font-mono tabular-nums">{Math.round(progress)}%</span>
      </div>
      <div role="progressbar" aria-label={ar ? "تقدم جلب الوثائق" : "Progression de l’import"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-club-primary via-rose-500 to-emerald-400 transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </div>}
  </div>;
}
