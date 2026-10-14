"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, LoaderCircle } from "lucide-react";
import { getMatchBackgroundJobStatusAction, syncFAFMatchDocumentsAction } from "@/app/[locale]/(dashboard)/dashboard/matches/actions";
import { Button } from "@/components/ui/button";

export function FafEmsSyncButton({ matchId, locale }: { matchId: string; locale: string }) {
  const [pending, setPending] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
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
        setJobStatus(state.status);
        const statusMessage = [state.message, state.warning, state.error].filter(Boolean).join(" ");
        setJobMessage(statusMessage);
        if (state.status === "SUCCEEDED") {
          if (state.type === "faf.match_sync" && state.followUpJobId) {
            setJobMessage([state.warning, ar ? "تم جلب الوثائق. يجري الآن تحليل التقرير وربط الأحداث باللاعبين…" : "Documents importés. Analyse du rapport et attribution aux joueurs en cours…"].filter(Boolean).join(" "));
            setJobStatus("RUNNING");
            setJobId(state.followUpJobId);
          } else {
            setJobId(null);
            const completedMessage = state.type === "match.referee_report_analysis"
              ? state.analysis?.summary || (ar ? "اكتمل تحليل تقرير المباراة." : "Analyse du rapport terminée.")
              : (ar ? "اكتمل جلب وثائق وتفاصيل المباراة." : "Documents et détails du match importés.");
            const fallbackNotice = state.analysis?.aiFallback
              ? ar ? " (استُخدم التحليل الاحتياطي لضمان استمرار العملية.)" : " (Le moteur de secours a assuré la continuité.)"
              : "";
            toast.success(`${completedMessage}${fallbackNotice}`);
            if (state.warning) toast.warning(state.warning);
            router.refresh();
          }
        } else if (["FAILED", "CANCELLED"].includes(state.status)) {
          setJobId(null);
          const failureMessage = state.type === "match.referee_report_analysis"
            ? ar ? `حُفظت وثائق المباراة، لكن تحليل التقرير تعثر. ${state.error || state.message}` : `Les documents sont enregistrés, mais l’analyse a échoué. ${state.error || state.message}`
            : state.error || state.message;
          toast.error(failureMessage);
        } else {
          timer = setTimeout(poll, 2500);
        }
      } catch (error) {
        if (cancelled) return;
        setJobId(null);
        setJobStatus("FAILED");
        const message = error instanceof Error ? error.message : (ar ? "تعذر متابعة حالة الاستيراد." : "Impossible de suivre l’import.");
        setJobMessage(message);
        toast.error(message);
      }
    };
    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [jobId, matchId, locale, ar, router]);

  const jobActive = Boolean(jobId);
  return <div className="space-y-2">
  <Button type="button" size="sm" variant="outline" onClick={async () => {
    setPending(true);
    try {
      const result = await syncFAFMatchDocumentsAction(matchId, locale);
      if (!result.success) throw new Error(result.message);
      setJobMessage(result.message);
      setJobStatus("QUEUED");
      setJobId(result.jobId);
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (ar ? "تعذر الاتصال بمنصة FAF EMS." : "Impossible de synchroniser avec FAF EMS."));
    } finally { setPending(false); }
  }} disabled={pending || jobActive}>
    {pending || jobActive ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Download className="me-2 h-4 w-4" />}
    {pending || jobActive ? (ar ? "جارٍ الجلب والمعالجة..." : "Import en cours…") : (ar ? "جلب وثائق FAF EMS" : "Importer les documents FAF EMS")}
  </Button>
  {jobMessage && <p role="status" className={`text-xs ${jobStatus === "FAILED" ? "text-destructive" : jobStatus === "SUCCEEDED" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{jobMessage}</p>}
  </div>;
}
