"use client";

import { useState, useTransition } from "react";
import { Sparkles, Bot, CheckCircle2, AlertCircle, Loader2, X, Info, Target, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeRefereeReportWithAIAction } from "@/app/[locale]/(dashboard)/dashboard/matches/actions";

interface RefereeReportAiModalProps {
  matchId: string;
  defaultText?: string;
  locale?: string;
  hasAttachedReport?: boolean;
}

export function RefereeReportAiModal({
  matchId,
  defaultText = "",
  locale = "ar",
  hasAttachedReport = false
}: RefereeReportAiModalProps) {
  const aiEnabled = process.env.NEXT_PUBLIC_AI_ENABLED === "true";
  const [isOpen, setIsOpen] = useState(false);
  const [reportText, setReportText] = useState(defaultText);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    eventsCreated: number;
    summary: string;
    events: Array<{
      playerName: string;
      type: string;
      minute: number;
      notes?: string;
      matchedPlayerName?: string;
    }>;
    aiProviderUsed: "CLOUDFLARE_WORKERS_AI" | "LOCAL_OLLAMA" | "INTELLIGENT_NLP_ENGINE";
    aiFallback?: "quota" | "unavailable" | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAr = locale === "ar";

  function handleAnalyze() {
    setError(null);
    setResult(null);

    if (!reportText.trim() && !hasAttachedReport) {
      setError(isAr ? "أدخل نص التقرير أو ارفع تقرير الحكم أولاً." : "Saisissez le rapport ou joignez d’abord le document.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        if (reportText) {
          formData.append("reportText", reportText);
        }
        const res = await analyzeRefereeReportWithAIAction(matchId, formData);
        setResult(res);
      } catch (err: any) {
        setError(err.message || (isAr ? "فشل تحليل التقرير بالذكاء الاصطناعي" : "Échec de l'analyse IA"));
      }
    });
  }

  return (
    <>
      {aiEnabled && <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="h-8 min-h-8 shrink-0 gap-1.5 rounded-md border-purple-500/30 bg-purple-500/5 px-3 text-xs font-semibold text-purple-700 hover:bg-purple-500/10 dark:text-purple-300"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-purple-500" />
        <span>{isAr ? "تحليل بالذكاء الاصطناعي" : "Analyser avec l’IA"}</span>
      </Button>}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Container */}
          <div
            dir={isAr ? "rtl" : "ltr"}
            className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 start-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3 border-b border-border/60 p-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 pe-7">
                <h2 className="flex items-center gap-1.5 text-base font-bold leading-tight text-foreground">
                  <span>{isAr ? "المساعد الذكي لتحليل تقرير الحكم" : "Assistant IA pour l’analyse du rapport d’arbitrage"}</span>
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {isAr
                    ? "يقوم الذكاء الاصطناعي بقراءة أسماء اللاعبين، واكتشاف الأهداف والبطاقات وربطها تلقائياً بملفاتهم"
                    : "Extraction automatique des buteurs, passeurs et cartons depuis le rapport"}
                </p>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                  <FileCheck2 className="h-3 w-3" />
                  {hasAttachedReport
                    ? (isAr ? "تقرير مرفق جاهز للتحليل" : "Rapport joint prêt à analyser")
                    : (isAr ? "إدخال يدوي للتقرير" : "Saisie manuelle du rapport")}
                </span>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
            {/* Content Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-foreground">
                {isAr ? "نص تقرير الحكم أو أحداث اللقاء:" : "Texte du rapport d'arbitrage:"}
                </label>
                <span className="text-[10px] tabular-nums text-muted-foreground">{reportText.length}/5000</span>
              </div>
              <textarea
                rows={5}
                maxLength={5000}
                value={reportText}
                onChange={(e) => { setReportText(e.target.value); setResult(null); setError(null); }}
                placeholder={
                  isAr
                    ? "مثال: د 34 هدف للاعب كريم سلطاني، د 58 بطاقة صفراء للاعب سمير بوعزة بسبب تدخل متهور، د 72 هدف اللاعب أمين درويش بتمريرة من رقم 10..."
                    : "Ex: 34' But Karim Soltani, 58' Carton jaune Samir Bouazza..."
                }
                className="min-h-36 w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-6 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40"
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {isAr
                    ? "يمكنك نسخ نص التقرير الصادر من بوابة FAF EMS أو تدوين ملخص صافرة النهاية."
                    : "Collez le rapport issu de la FAF EMS ou le relevé d'arbitrage."}
                </span>
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Result */}
            {result && (
              <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{result.summary}</span>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-muted-foreground">
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1">{isAr ? `تمت إضافة ${result.eventsCreated} حدث` : `${result.eventsCreated} événement(s) ajouté(s)`}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1">{result.aiProviderUsed === "CLOUDFLARE_WORKERS_AI" ? "Cloudflare AI" : result.aiProviderUsed === "LOCAL_OLLAMA" ? "Ollama AI" : (isAr ? "محرك التحليل الذكي" : "Moteur NLP")}</span>
                </div>
                {result.aiFallback && <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  {isAr ? result.aiFallback === "quota" ? "انتهت حصة الذكاء الاصطناعي اليوم؛ أكملنا تحليل التقرير بالمحرك الاحتياطي." : "الذكاء الاصطناعي غير متاح؛ أكملنا تحليل التقرير بالمحرك الاحتياطي." : result.aiFallback === "quota" ? "Quota IA épuisé aujourd’hui ; l’analyse a continué avec le moteur de secours." : "IA indisponible ; l’analyse a continué avec le moteur de secours."}
                </p>}

                {result.events.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {isAr ? "الأحداث المستخرجة والمضافة لسجلات اللاعبين:" : "Événements détectés et attribués:"}
                    </p>
                    <div className="divide-y divide-border/60 rounded-lg border border-border bg-card overflow-hidden">
                      {result.events.map((evt, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 text-xs">
                          <span className="font-semibold text-foreground">
                            {evt.matchedPlayerName || evt.playerName}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] font-bold">
                            {evt.type === "GOAL" ? (
                              <>
                                <Target className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                <span>{isAr ? `هدف (${evt.minute}')` : `But (${evt.minute}')`}</span>
                              </>
                            ) : evt.type === "YELLOW_CARD" ? (
                              <>
                                <span className="inline-block w-2.5 h-3.5 rounded-2xs bg-amber-400 border border-amber-500 shadow-2xs" />
                                <span>{isAr ? `صفراء (${evt.minute}')` : `Jaune (${evt.minute}')`}</span>
                              </>
                            ) : evt.type === "RED_CARD" ? (
                              <>
                                <span className="inline-block w-2.5 h-3.5 rounded-2xs bg-red-500 border border-red-600 shadow-2xs" />
                                <span>{isAr ? `حمراء (${evt.minute}')` : `Rouge (${evt.minute}')`}</span>
                              </>
                            ) : (
                              <span>{`${evt.type} (${evt.minute}')`}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 p-5 pt-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
              >
                {isAr ? "إغلاق" : "Fermer"}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleAnalyze}
                disabled={isPending || (!reportText.trim() && !hasAttachedReport)}
                className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{isAr ? "جاري التحليل الذكي..." : "Analyse en cours..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{isAr ? "تشغيل التحليل الذكي وإضافة الأهداف" : "Lancer l'analyse"}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
