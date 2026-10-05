import "server-only";
import { runAICompletion, checkAIAvailability } from "./provider";

export interface CoachSessionPlayerContext {
  id: string;
  name: string;
  shirtNumber?: number | null;
  position?: string | null;
  status: string;
  scoreDisplay?: string | null;
  summaryScore?: number | null;
  secondaryScore?: number | null;
  measurements: Record<string, any>;
}

export interface CoachSessionContext {
  sessionId: string;
  sessionTitle: string;
  teamName: string;
  protocolCode: string;
  protocolName: string;
  primaryUnit?: string | null;
  secondaryUnit?: string | null;
  date: string;
  players: CoachSessionPlayerContext[];
  locale?: string;
}

export interface CoachInsightReport {
  summary: string;
  executiveDiagnosis: string;
  keyFindings: string[];
  coachRecommendations: string[];
  metrics: { label: string; unit: string; count: number; average: number | null; minimum: number | null; maximum: number | null }[];
  aiProviderUsed: "LOCAL_OLLAMA" | "DETERMINISTIC_SPORTS_SCIENCE";
}

const COACH_AI_SYSTEM_PROMPT =
  "أنت مساعد للمدرب تلخص بيانات اختبارات اللاعبين. استخدم فقط القياسات المعروضة والبروتوكول المحدد. لا تخترع نتائج أو معايير تصنيف أو تشخيصات طبية أو تقديرات جاهزية للمباراة. لا تستنتج قدرة 90 دقيقة أو حاجة اللاعب إلى برنامج تدريبي من نتيجة منفردة. ميّز القياسات المباشرة عن القيم التقديرية، واذكر نقص السياق عند الحاجة. قدّم ملاحظات وصفية وأسئلة تحقق للمدرب، واجعل القرارات التدريبية النهائية للمدرب. أجب بلغة الواجهة وباختصار.";

export async function generateCoachTestingInsights(ctx: CoachSessionContext): Promise<CoachInsightReport> {
  const validPlayers = ctx.players.filter((p) => p.status === "VALID");
  const isArabic = (ctx.locale || "ar") === "ar";
  const metricDefinitions = [
    { key: "summaryScore" as const, label: isArabic ? "النتيجة الأساسية" : "Résultat principal", unit: ctx.primaryUnit || "" },
    ...(ctx.secondaryUnit ? [{ key: "secondaryScore" as const, label: isArabic ? "النتيجة الثانوية" : "Résultat secondaire", unit: ctx.secondaryUnit }] : [])
  ];
  const metrics = metricDefinitions.map(({ key, label, unit }) => {
    const values = validPlayers.map((p) => p[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    return { label, unit, count: values.length, average: values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : null, minimum: values.length ? Math.min(...values) : null, maximum: values.length ? Math.max(...values) : null };
  });
  const metricLines = metrics.map((m) => `${m.label}: n=${m.count}, mean=${m.average ?? "n/a"} ${m.unit}, min=${m.minimum ?? "n/a"}, max=${m.maximum ?? "n/a"}`).join("\n");
  // Keep athlete identities out of the local model prompt; only anonymous measurements are needed.
  const playerLines = validPlayers.map((p, index) => {
    const measurements = Object.entries(p.measurements || {})
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(", ");
    return `- Athlete ${index + 1}: ${p.summaryScore ?? "—"} ${ctx.primaryUnit || ""}${p.secondaryScore == null ? "" : `; secondary ${p.secondaryScore} ${ctx.secondaryUnit || ""}`}${measurements ? `; ${measurements}` : ""}`;
  }).join("\n");

  const promptInput =
    `Session: ${ctx.sessionTitle}\nTeam: ${ctx.teamName}\nProtocol: ${ctx.protocolName} (${ctx.protocolCode})\nDate: ${ctx.date}\n` +
    `Valid results: ${validPlayers.length}/${ctx.players.length}\n${metricLines}\n${playerLines || "No valid measurements."}\n\n` +
    "Summarize only observable values and variation in this dataset. Do not apply external norms, tiers, rankings beyond the values shown, or prescribe training loads. State that the coach should verify conditions, protocol completion, and context before interpretation.";

  const availability = await checkAIAvailability();
  if (availability.available) {
    try {
      const completion = await runAICompletion({
        system: COACH_AI_SYSTEM_PROMPT,
        input: promptInput,
        maxTokens: 1000,
        timeoutMs: 12000
      });
      if (completion?.trim().length > 20) {
        return {
          summary: isArabic ? "ملاحظات وصفية مولدة بالذكاء الاصطناعي" : "Observations descriptives générées par IA",
          executiveDiagnosis: completion.trim(),
          metrics,
          keyFindings: [
            isArabic ? `${validPlayers.length} نتيجة صالحة من أصل ${ctx.players.length}` : `${validPlayers.length} résultats valides sur ${ctx.players.length}`,
            isArabic ? `البروتوكول: ${ctx.protocolName}` : `Protocole : ${ctx.protocolName}`
          ],
          coachRecommendations: [
            isArabic ? "تحقق من اكتمال البروتوكول وظروف القياس قبل اعتماد النتائج." : "Vérifiez le protocole et les conditions de mesure avant de retenir les résultats.",
            isArabic ? "قارن اللاعب بنفس البروتوكول وظروف متقاربة، وفسّر النتائج ضمن العمر والمركز والحالة الصحية." : "Comparez chaque joueur avec le même protocole et des conditions similaires, en tenant compte de son contexte."
          ],
          aiProviderUsed: "LOCAL_OLLAMA"
        };
      }
    } catch (err) {
      console.warn("[Coach AI Assistant] Local model unavailable; returning a descriptive fallback.", err);
    }
  }

  const note = isArabic
    ? `جلسة ${ctx.protocolName} بتاريخ ${ctx.date}: توجد ${validPlayers.length} نتيجة صالحة من أصل ${ctx.players.length}. يعرض جدول الجلسة القياسات المسجلة دون تطبيق معايير تصنيف أو استنتاج الجاهزية للمباريات. راجع اكتمال البروتوكول وظروف القياس والسياق الفردي قبل تفسيرها.`
    : `Session ${ctx.protocolName} du ${ctx.date} : ${validPlayers.length} résultats valides sur ${ctx.players.length}. Le tableau présente les mesures saisies sans norme de classement ni conclusion sur l’aptitude aux matchs. Vérifiez le protocole, les conditions de mesure et le contexte individuel avant interprétation.`;
  return {
    summary: isArabic ? "ملخص وصفي للبيانات المسجلة" : "Résumé descriptif des données saisies",
    executiveDiagnosis: note,
    metrics,
    keyFindings: [
      isArabic ? `${validPlayers.length} نتيجة صالحة من أصل ${ctx.players.length}` : `${validPlayers.length} résultats valides sur ${ctx.players.length}`,
      isArabic ? `البروتوكول: ${ctx.protocolName}` : `Protocole : ${ctx.protocolName}`
    ],
    coachRecommendations: [
      isArabic ? "تحقق من اكتمال البروتوكول وظروف القياس قبل اعتماد النتائج." : "Vérifiez le protocole et les conditions de mesure avant de retenir les résultats.",
      isArabic ? "قارن النتائج عبر الزمن باستخدام البروتوكول نفسه، وفسّرها ضمن السياق الفردي." : "Comparez les résultats dans le temps avec le même protocole et interprétez-les dans leur contexte individuel."
    ],
    aiProviderUsed: "DETERMINISTIC_SPORTS_SCIENCE"
  };
}
