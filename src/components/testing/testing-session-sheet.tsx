"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { YOYO_IR1_LEVELS, calculateYoYoDistance, calculateYoYoVO2max, deriveYoYoLevelAndShuttle } from "@/lib/testing/protocols/yoyo-ir1";
import { YOYO_IR2_LEVELS, calculateYoYoIR2Distance, calculateYoYoIR2VO2max, deriveYoYoIR2LevelAndShuttle } from "@/lib/testing/protocols/yoyo-ir2";
import {
  saveSessionMeasurementsAction,
  completeTestSessionAction,
  correctTestResultAction,
  getCoachTestingAIInsightsAction
} from "@/app/[locale]/(dashboard)/dashboard/testing/actions";
import { printDocumentElement } from "@/lib/documents/print-helper";
import { getPlayerDisplayName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Timer,
  Save,
  CheckCircle2,
  AlertCircle,
  Trophy,
  History,
  RotateCcw,
  Edit3,
  Users,
  Printer,
  Calculator,
  ChevronDown,
  ChevronUp,
  Activity,
  Sparkles,
  Shield,
  Brain,
  Bot,
  Loader2
} from "lucide-react";
import { formatMeasurement, formatTestScore } from "@/lib/testing/formatters";
import { YoYoConductor } from "./yoyo-conductor";
import { OfficialTestingReportModal } from "./official-testing-report-modal";
import { OfficialDocumentHeader } from "@/components/documents/official-document-header";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";

export interface SessionPlayerData {
  id: string;
  firstName: string;
  lastName: string;
  firstNameFr?: string | null;
  lastNameFr?: string | null;
  shirtNumber: number | null;
  position: string;
  photoUrl: string | null;
  resultId?: string;
  status: "VALID" | "INCOMPLETE" | "DISQUALIFIED" | "ABSENT";
  summaryScore?: number | null;
  secondaryScore?: number | null;
  scoreDisplay?: string | null;
  rank?: number | null;
  isCorrected?: boolean;
  correctionReason?: string | null;
  notes?: string | null;
  measurements: Record<string, string | number>;
}

export function TestingSessionSheet({
  sessionId,
  sessionTitle,
  protocolCode,
  protocolName,
  primaryUnit,
  secondaryUnit,
  status: initialStatus,
  canManage,
  canCorrect,
  players,
  locale,
  teamName,
  teamCategory,
  location,
  date,
  conductorName
}: {
  sessionId: string;
  sessionTitle: string;
  protocolCode: string;
  protocolName: string;
  primaryUnit: string;
  secondaryUnit?: string | null;
  status: "DRAFT" | "COMPLETED" | "CANCELLED";
  canManage: boolean;
  canCorrect: boolean;
  players: SessionPlayerData[];
  locale: string;
  teamName?: string;
  teamCategory?: string;
  location?: string | null;
  date?: Date | string;
  conductorName?: string;
}) {
  const aiEnabled = process.env.NEXT_PUBLIC_AI_ENABLED === "true";
  const t = useTranslations("testing");
  const tCommon = useTranslations("common");
  const isYoYoIR1 = protocolCode === "YOYO_IR1";
  const isYoYoIR2 = protocolCode === "YOYO_IR2";
  const isYoYo = isYoYoIR1 || isYoYoIR2;
  const yoYoLevels = isYoYoIR2 ? YOYO_IR2_LEVELS : YOYO_IR1_LEVELS;
  const getYoYoDistance = isYoYoIR2 ? calculateYoYoIR2Distance : calculateYoYoDistance;
  const getYoYoVO2max = isYoYoIR2 ? calculateYoYoIR2VO2max : calculateYoYoVO2max;
  const deriveYoYoResult = isYoYoIR2 ? deriveYoYoIR2LevelAndShuttle : deriveYoYoLevelAndShuttle;
  const [sessionStatus, setSessionStatus] = useState(initialStatus);
  const [data, setData] = useState<SessionPlayerData[]>(() => {
    return players.map((p) => {
      const rawLevel = p.measurements?.level;
      const rawShuttle = p.measurements?.shuttle;
      const hasRecordedLevel = rawLevel !== undefined && rawLevel !== null && rawLevel !== "";
      const hasRecordedShuttle = rawShuttle !== undefined && rawShuttle !== null && rawShuttle !== "";
      const hasRecordedScore = typeof p.summaryScore === "number" && p.summaryScore > 0;

      // Only format Yo-Yo scores for players who actually have recorded results
      if ((protocolCode === "YOYO_IR1" || protocolCode === "YOYO_IR2") && p.status === "VALID" && (hasRecordedLevel || hasRecordedScore)) {
        let curLevel = hasRecordedLevel ? Number(rawLevel) : (isYoYoIR2 ? 11 : 5);
        let curShuttle = hasRecordedShuttle ? Number(rawShuttle) : 1;
        let distance = hasRecordedScore ? (p.summaryScore as number) : 0;

        if (distance > 0 && !hasRecordedLevel) {
          const derived = deriveYoYoResult(distance);
          curLevel = derived.level;
          curShuttle = derived.shuttle;
        } else if (hasRecordedLevel && hasRecordedShuttle && distance <= 0) {
          try {
            distance = getYoYoDistance(curLevel, curShuttle);
          } catch {
            distance = 0;
          }
        }

        const vo2 = typeof p.secondaryScore === "number" && p.secondaryScore > 0 
          ? p.secondaryScore 
          : (distance > 0 ? getYoYoVO2max(distance) : null);

        return {
          ...p,
          measurements: {
            ...p.measurements,
            level: curLevel,
            shuttle: curShuttle,
            distance,
            vo2max: vo2 ?? 0,
          },
          summaryScore: distance > 0 ? distance : null,
          secondaryScore: vo2,
          scoreDisplay: p.scoreDisplay || (distance > 0 ? `${curLevel}.${curShuttle} (${distance.toLocaleString()} m)` : null),
        };
      }
      return p;
    });
  });
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isSprint = protocolCode === "SPRINT_30M" || protocolCode === "FIFA_RSA";
  const isJump = protocolCode === "VERTICAL_JUMP";

  const [viewMode, setViewMode] = useState<"CONDUCTOR" | "SHEET">(() => {
    return isYoYoIR1 && initialStatus === "DRAFT" ? "CONDUCTOR" : "SHEET";
  });

  // Correction dialog state
  const [correctionTarget, setCorrectionTarget] = useState<SessionPlayerData | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionMeasurements, setCorrectionMeasurements] = useState<Record<string, any>>({});

  const [showScienceCard, setShowScienceCard] = useState(false);
  const [calcLevel, setCalcLevel] = useState(isYoYoIR2 ? 20 : 15);
  const [calcShuttle, setCalcShuttle] = useState(4);

  // Coach AI Assistant State
  const [aiReport, setAiReport] = useState<{
    summary: string; executiveDiagnosis: string; keyFindings: string[]; coachRecommendations: string[];
    metrics: { label: string; unit: string; count: number; average: number | null; minimum: number | null; maximum: number | null }[];
    aiProviderUsed: "LOCAL_OLLAMA" | "DETERMINISTIC_SPORTS_SCIENCE";
  } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // Official Report Print Modal
  const [showOfficialReportModal, setShowOfficialReportModal] = useState(false);

  const handleOpenAIAssistant = async () => {
    setShowAiModal(true);
    setIsAiLoading(true);
    setAiReport(null);
    try {
      const currentRows = data.map(({ id, status, summaryScore, secondaryScore, measurements }) => ({ id, status, summaryScore, secondaryScore, measurements }));
      const res = await getCoachTestingAIInsightsAction(sessionId, locale, currentRows);
      if (res.success && res.report) {
        setAiReport(res.report);
      } else {
        setMessage({ type: "error", text: res.error || "Failed to generate AI insights" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to generate AI insights" });
    } finally {
      setIsAiLoading(false);
    }
  };

  // Athletic computational statistics
  const validPlayers = data.filter((p) => p.status === "VALID");
  const distances = validPlayers
    .map((p) => Number(p.summaryScore || p.measurements.distance || 0))
    .filter((d) => d > 0);
  const avgDistance = distances.length > 0 ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length) : 0;
  const maxDistance = distances.length > 0 ? Math.max(...distances) : 0;
  const avgVO2 = isYoYo && avgDistance > 0 ? getYoYoVO2max(avgDistance) : null;
  const maxVO2 = isYoYo && maxDistance > 0 ? getYoYoVO2max(maxDistance) : null;

  const quickCalcDist = isYoYo ? getYoYoDistance(calcLevel, calcShuttle) : 0;
  const quickCalcVO2 = isYoYo ? getYoYoVO2max(quickCalcDist) : 0;

  const handleYoYoChange = (playerId: string, field: "level" | "shuttle", val: number) => {
    setData((prev) =>
      prev.map((p) => {
        if (p.id !== playerId) return p;
        const curLevel = field === "level" ? val : Number(p.measurements.level || (isYoYoIR2 ? 11 : 5));
        const levelInfo = yoYoLevels.find((l) => l.level === curLevel) || yoYoLevels[0]!;
        let curShuttle = field === "shuttle" ? val : Number(p.measurements.shuttle || 1);
        if (curShuttle > levelInfo.shuttlesInLevel) {
          curShuttle = levelInfo.shuttlesInLevel;
        }

        const distance = getYoYoDistance(curLevel, curShuttle);
        const vo2 = getYoYoVO2max(distance);

        return {
          ...p,
          status: "VALID",
          measurements: {
            ...p.measurements,
            level: curLevel,
            shuttle: curShuttle,
            distance,
          },
          summaryScore: distance,
          secondaryScore: vo2,
          scoreDisplay: `${curLevel}.${curShuttle} (${distance.toLocaleString()} m)`,
        };
      })
    );
  };

  const handleGenericChange = (playerId: string, key: string, value: string) => {
    setData((prev) =>
      prev.map((p) => {
        if (p.id !== playerId) return p;
        const num = parseFloat(value);
        return {
          ...p,
          measurements: {
            ...p.measurements,
            [key]: isNaN(num) ? value : num,
          },
          summaryScore: isNaN(num) ? p.summaryScore : num,
          scoreDisplay: !isNaN(num) ? `${num} ${primaryUnit}` : p.scoreDisplay,
        };
      })
    );
  };

  const handleStatusChange = (playerId: string, status: "VALID" | "INCOMPLETE" | "DISQUALIFIED" | "ABSENT") => {
    if (isYoYo && status === "VALID") {
      const selectedPlayer = data.find((player) => player.id === playerId);
      if (selectedPlayer?.measurements.level == null || selectedPlayer?.measurements.shuttle == null) {
        setMessage({
          type: "error",
          text: locale === "ar" ? "أدخل مستوى اللاعب وعدد مرات الذهاب والإياب أولًا لتسجيل نتيجة صالحة." : "Saisissez d’abord le niveau et la navette du joueur pour valider son résultat.",
        });
        return;
      }
    }
    setData((prev) =>
      prev.map((p) => {
        if (p.id !== playerId) return p;
        if (isYoYo && status === "VALID") {
          const curLevel = Number(p.measurements?.level || (isYoYoIR2 ? 11 : 5));
          const curShuttle = Number(p.measurements?.shuttle || 1);
          const dist = getYoYoDistance(curLevel, curShuttle);
          const vo2 = getYoYoVO2max(dist);
          return {
            ...p,
            status,
            measurements: {
              ...p.measurements,
              level: curLevel,
              shuttle: curShuttle,
              distance: dist,
              vo2max: vo2,
            },
            summaryScore: dist,
            secondaryScore: vo2,
            scoreDisplay: `${curLevel}.${curShuttle} (${dist.toLocaleString()} m)`,
          };
        }
        return { ...p, status };
      })
    );
  };

  const handleSaveDraft = () => {
    setMessage(null);
    startTransition(async () => {
      const updatedData = data.map((p) => {
        const measurementsCopy = { ...p.measurements };
        if (isYoYo && p.status === "VALID") {
          const curLevel = Number(measurementsCopy.level || (isYoYoIR2 ? 11 : 5));
          const curShuttle = Number(measurementsCopy.shuttle || 1);
          const distance = getYoYoDistance(curLevel, curShuttle);
          const vo2 = getYoYoVO2max(distance);
          measurementsCopy.level = curLevel;
          measurementsCopy.shuttle = curShuttle;
          measurementsCopy.distance = distance;
          measurementsCopy.vo2max = vo2;
          return {
            ...p,
            measurements: measurementsCopy,
            summaryScore: distance,
            secondaryScore: vo2,
            scoreDisplay: `${curLevel}.${curShuttle} (${distance.toLocaleString()} m)`
          };
        }
        return p;
      });

      setData(updatedData);

      const entries = updatedData.map((p) => {
        const rawMeasurements = Object.entries(p.measurements).map(([k, v], idx) => ({
          key: k,
          value: String(v),
          numericValue: typeof v === "number" ? v : parseFloat(String(v)) || null,
          unit: k === "distance" ? "m" : k.startsWith("time") ? "s" : k.startsWith("height") ? "cm" : null,
          attempt: idx + 1,
        }));
        return {
          playerId: p.id,
          status: p.status,
          measurements: rawMeasurements,
          notes: p.notes ?? null,
        };
      });

      const res = await saveSessionMeasurementsAction(sessionId, entries);
      if (res.success) {
        setMessage({ type: "success", text: t("messages.draftSaved") });
      } else {
        setMessage({ type: "error", text: res.error || t("messages.error") });
      }
    });
  };

  const handleComplete = () => {
    if (!confirm(t("confirmComplete"))) return;
    setMessage(null);
    startTransition(async () => {
      const updatedData = data.map((p) => {
        const measurementsCopy = { ...p.measurements };
        if (isYoYo && p.status === "VALID") {
          const curLevel = Number(measurementsCopy.level || (isYoYoIR2 ? 11 : 5));
          const curShuttle = Number(measurementsCopy.shuttle || 1);
          const distance = getYoYoDistance(curLevel, curShuttle);
          const vo2 = getYoYoVO2max(distance);
          measurementsCopy.level = curLevel;
          measurementsCopy.shuttle = curShuttle;
          measurementsCopy.distance = distance;
          measurementsCopy.vo2max = vo2;
          return {
            ...p,
            measurements: measurementsCopy,
            summaryScore: distance,
            secondaryScore: vo2,
            scoreDisplay: `${curLevel}.${curShuttle} (${distance.toLocaleString()} m)`
          };
        }
        return p;
      });

      setData(updatedData);

      // Save current values
      const entries = updatedData.map((p) => ({
        playerId: p.id,
        status: p.status,
        measurements: Object.entries(p.measurements).map(([k, v], idx) => ({
          key: k,
          value: String(v),
          numericValue: typeof v === "number" ? v : parseFloat(String(v)) || null,
          attempt: idx + 1,
        })),
        notes: p.notes ?? null,
      }));

      const saveRes = await saveSessionMeasurementsAction(sessionId, entries);
      if (!saveRes.success) {
        setMessage({ type: "error", text: saveRes.error || t("messages.error") });
        return;
      }

      const compRes = await completeTestSessionAction(sessionId);
      if (compRes.success) {
        setSessionStatus("COMPLETED");
        setMessage({ type: "success", text: t("messages.sessionCompleted") });
        window.location.reload();
      } else {
        setMessage({ type: "error", text: compRes.error || t("messages.error") });
      }
    });
  };

  const openCorrectionDialog = (player: SessionPlayerData) => {
    setCorrectionTarget(player);
    setCorrectionReason(locale === "ar" ? "تصحيح نتيجة اللاعب بعد المراجعة" : "Correction après vérification");
    setCorrectionMeasurements({ ...player.measurements });
  };

  const submitCorrection = () => {
    if (!correctionTarget?.resultId) return;
    const finalReason =
      correctionReason.trim().length >= 5
        ? correctionReason.trim()
        : locale === "ar"
        ? "تصحيح نتيجة اللاعب بعد المراجعة"
        : "Correction après vérification";

    startTransition(async () => {
      let rawMeasurements: any[] = [];
      if (isYoYo) {
        const lvl = Number(correctionMeasurements.level || (isYoYoIR2 ? 11 : 5));
        const sht = Number(correctionMeasurements.shuttle || 1);
        const dist = getYoYoDistance(lvl, sht);
        rawMeasurements = [
          { key: "level", value: String(lvl), numericValue: lvl, attempt: 1 },
          { key: "shuttle", value: String(sht), numericValue: sht, attempt: 1 },
          { key: "distance", value: String(dist), numericValue: dist, attempt: 1 },
        ];
      } else {
        rawMeasurements = Object.entries(correctionMeasurements).map(([k, v], idx) => ({
          key: k,
          value: String(v),
          numericValue: typeof v === "number" ? v : parseFloat(String(v)) || null,
          attempt: idx + 1,
        }));
      }

      const res = await correctTestResultAction(
        correctionTarget.resultId!,
        finalReason,
        rawMeasurements,
        correctionTarget.status,
        correctionTarget.notes
      );

      if (res.success) {
        setCorrectionTarget(null);
        setMessage({ type: "success", text: t("messages.corrected") });
        window.location.reload();
      } else {
        alert(res.error || "Failed to correct");
      }
    });
  };

  if (isYoYo && viewMode === "CONDUCTOR") {
    return (
      <div className="space-y-6">
        <YoYoConductor
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          players={data}
          canManage={canManage}
          locale={locale}
          onSwitchToManual={(updatedRunners) => {
            if (updatedRunners && updatedRunners.length > 0) {
              const runnerMap = new Map(updatedRunners.map((r) => [r.playerId, r]));
              setData((prev) =>
                prev.map((p) => {
                  const r = runnerMap.get(p.id);
                  if (!r || r.level === null || r.shuttle === null) return p;
                  return {
                    ...p,
                    measurements: {
                      ...p.measurements,
                      level: r.level,
                      shuttle: r.shuttle,
                      distance: r.distance ?? getYoYoDistance(r.level, r.shuttle)
                    },
                    summaryScore: r.distance,
                    secondaryScore: r.vo2max,
                    scoreDisplay: r.scoreDisplay,
                    status:
                      r.status === "STOPPED"
                        ? "VALID"
                        : r.status === "ABSENT"
                        ? "ABSENT"
                        : r.status === "WITHDRAWN"
                        ? "INCOMPLETE"
                        : p.status
                  };
                })
              );
            }
            setViewMode("SHEET");
          }}
        />
      </div>
    );
  }

  const testingDocId = `esh-testing-sheet-${sessionId}`;

  return (
    <div id={testingDocId} className="space-y-6">
      {/* Official printable institutional header (visible only when printing) */}
      <div
        className="hidden print:block mb-6 text-black space-y-4"
        style={{ fontFamily: "'Traditional Arabic', 'Arabic Typesetting', serif" }}
      >
        <OfficialDocumentHeader
          badgeText={locale === "ar" ? "محضر تقييم" : "PV d'Évaluation"}
          referenceNumber={`ESH/DEP/${sessionId.slice(-6).toUpperCase()}/${new Date().getFullYear()}`}
          date={date || new Date()}
          documentTitle={
            locale === "ar"
              ? "محضر جلسة الاختبارات والتقييم البدني"
              : "Procès-Verbal de Session d'Évaluation Physique"
          }
          documentSubtitle={isYoYo ? "Yo-Yo Test" : `${protocolName} (${protocolCode})`}
          locale={locale}
        />

        {/* Statistical Summary Box in Print */}
        <div className="grid grid-cols-4 gap-3 text-[13px] sm:text-[14px] bg-gray-50 p-3.5 rounded border border-gray-400">
          <div>
            <span className="text-gray-500 font-semibold block">{locale === "ar" ? "عنوان الجلسة:" : "Session :"}</span>
            <span className="font-bold text-black">{sessionTitle}</span>
          </div>
          <div>
            <span className="text-gray-500 font-semibold block">{locale === "ar" ? "البروتوكول العلمي:" : "Protocole :"}</span>
            <span className="font-bold text-black">{isYoYo ? "Yo-Yo Test" : `${protocolName} (${protocolCode})`}</span>
          </div>
          <div>
            <span className="text-gray-500 font-semibold block">{locale === "ar" ? "إجمالي اللاعبين:" : "Effectif évalué :"}</span>
            <span className="font-bold text-black">{data.length} {locale === "ar" ? "لاعب" : "joueurs"} ({validPlayers.length} {locale === "ar" ? "مكتمل" : "validés"})</span>
          </div>
          <div>
            <span className="text-gray-500 font-semibold block">{locale === "ar" ? "المعدل العام للفريق:" : "Moyenne équipe :"}</span>
            <span className="font-bold text-black">
              {avgDistance > 0 ? `${avgDistance.toLocaleString()} m` : "—"}
              {avgVO2 ? ` (VO₂: ${avgVO2})` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {message && (
        <div
          className={`print:hidden flex items-center gap-2 rounded-lg p-4 text-sm font-medium ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-red-600" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Protocol Banner & Quick Guide */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4 shadow-2xs gap-4">
        <div>
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">{protocolCode}</span>
          <h2 className="text-base font-bold text-foreground">{isYoYo ? "Yo-Yo Test" : protocolName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isYoYo && t("protocols.yoyoBannerDesc")}
            {isSprint && t("protocols.sprintBannerDesc")}
            {isJump && t("protocols.jumpBannerDesc")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 print:hidden">
          {isYoYo && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowScienceCard((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs h-9 border-border shadow-2xs"
            >
              <Calculator className="h-4 w-4 text-emerald-600" />
              <span>{locale === "ar" ? "حاسبة ومعايير اليويو" : "Calculateur Bangsbo"}</span>
              {showScienceCard ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          )}

          {isYoYoIR1 && sessionStatus === "DRAFT" && canManage && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setViewMode("CONDUCTOR")}
              className="flex items-center gap-1.5 text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
            >
              <Timer className="h-4 w-4" />
              <span>{t("conductor.modeConductor")}</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowOfficialReportModal(true)}
            className="flex items-center gap-1.5 text-xs h-9 shadow-2xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <Printer className="h-4 w-4" />
            <span>{locale === "ar" ? "معاينة وطباعة" : "Aperçu et impression"}</span>
          </Button>

          {aiEnabled && <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenAIAssistant}
            className="flex items-center gap-1.5 text-xs h-9 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/20 shadow-2xs"
          >
            <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>{locale === "ar" ? "المساعد الذكي للمدرب (AI)" : "Assistant IA Coach"}</span>
          </Button>}

          {sessionStatus === "DRAFT" && canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isPending}
                className="flex items-center gap-1.5 text-xs h-9"
              >
                <Save className="h-4 w-4" />
                <span>{t("actions.saveDraft")}</span>
              </Button>
              <Button
                size="sm"
                onClick={handleComplete}
                disabled={isPending}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-medium"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{t("actions.completeSession")}</span>
              </Button>
            </>
          )}

          {sessionStatus === "COMPLETED" && (
            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 py-1 px-3 text-xs flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{t("status.completed")}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Scientific Bangsbo Computational Card (Spec & Sports Science Reference) */}
      {isYoYo && showScienceCard && (
        <section className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-card shadow-sm print:hidden animate-in fade-in duration-200">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-linear-to-l from-emerald-500/[0.07] to-transparent px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Activity className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground sm:text-base">
                  {locale === "ar" ? `حاسبة اختبار يويو ${isYoYoIR2 ? "IR2" : "IR1"}` : `Calculateur Yo‑Yo ${isYoYoIR2 ? "IR2" : "IR1"}`}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {locale === "ar" ? "حساب فوري للمسافة وVO₂max التقديري حسب المستوى والتكرار." : "Calcul instantané de la distance et du VO₂max estimé selon le niveau et la navette."}
                </p>
              </div>
            </div>
            <Badge tone="success" className="gap-1.5 px-3 py-1 font-medium">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === "ar" ? "بروتوكول بانغسبو" : "Protocole de Bangsbo"}</span>
            </Badge>
          </header>

          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(17rem,0.9fr)]">
            <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-foreground">{locale === "ar" ? "حاسبة فورية" : "Calculateur instantané"}</h4>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  {locale === "ar" ? "اختر النتيجة" : "Choisissez le résultat"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{locale === "ar" ? "المستوى" : "Niveau"}</label>
                  <MasterFilterSelect
                    value={String(calcLevel)}
                    onChange={(value) => setCalcLevel(Number(value))}
                    locale={locale === "fr" ? "fr" : "ar"}
                    icon={Activity}
                    headerTitle={locale === "ar" ? "مستويات الاختبار" : "Niveaux du test"}
                    className="w-full [&>button]:h-11 [&>button]:w-full [&>button]:justify-between [&>button]:rounded-xl [&>button]:px-3"
                    options={yoYoLevels.map((lvl) => ({
                      id: String(lvl.level),
                      label: locale === "ar" ? `المستوى ${lvl.level} (${lvl.speedKmh} كم/س)` : `Niveau ${lvl.level} (${lvl.speedKmh} km/h)`,
                    }))}
                  />
                </div>
                <div className="min-w-0">
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{locale === "ar" ? "تكرار الذهاب والإياب" : "Navette"}</label>
                  <MasterFilterSelect
                    value={String(calcShuttle)}
                    onChange={(value) => setCalcShuttle(Number(value))}
                    locale={locale === "fr" ? "fr" : "ar"}
                    icon={RotateCcw}
                    headerTitle={locale === "ar" ? "تكرار الذهاب والإياب" : "Navettes"}
                    className="w-full [&>button]:h-11 [&>button]:w-full [&>button]:justify-between [&>button]:rounded-xl [&>button]:px-3"
                    options={Array.from({ length: yoYoLevels.find((l) => l.level === calcLevel)?.shuttlesInLevel || 8 }, (_, i) => i + 1)
                      .map((shuttle) => ({ id: String(shuttle), label: String(shuttle) }))}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex min-h-20 flex-col justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/[0.07] px-4 py-3">
                  <span className="text-xs font-medium text-muted-foreground">{locale === "ar" ? "المسافة الكلية" : "Distance totale"}</span>
                  <span dir="ltr" className="mt-1 flex items-baseline gap-2 font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                    <strong className="text-2xl font-black leading-none">{quickCalcDist.toLocaleString()}</strong>
                    <span className="text-sm font-semibold">m</span>
                  </span>
                </div>
                <div className="flex min-h-20 flex-col justify-center rounded-xl border border-sky-500/15 bg-sky-500/[0.07] px-4 py-3">
                  <span className="text-xs font-medium text-muted-foreground">{locale === "ar" ? "VO₂max تقديري" : "VO₂max estimé"}</span>
                  <span dir="ltr" className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono tabular-nums text-sky-700 dark:text-sky-300">
                    <strong className="text-2xl font-black leading-none">{quickCalcVO2}</strong>
                    <span className="text-[11px] font-semibold">ml/kg/min</span>
                  </span>
                </div>
              </div>
            </div>

            <aside className="flex flex-col justify-center rounded-xl border border-border bg-muted/15 p-4 sm:p-5">
              <div>
                <p className="text-xs font-bold text-foreground">{locale === "ar" ? "طريقة احتساب VO₂max" : "Calcul du VO₂max"}</p>
                <p dir="ltr" className="mt-2 rounded-lg border border-border bg-background px-3 py-3 text-center font-mono text-sm font-bold text-foreground">
                  VO₂max = {isYoYoIR2 ? "(distance × 0.0136) + 45.3" : "(distance × 0.0084) + 36.4"}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">Jens Bangsbo et al. (2008)</p>
              </div>
              <p className="mt-4 border-t border-border pt-3 text-xs leading-6 text-muted-foreground">
                {locale === "ar"
                  ? "قيمة VO₂max تقديرية وليست قياسًا مخبريًا مباشرًا. تعرض المنصة نتيجة الاختبار والحساب فقط، ولا تطبق تصنيفًا سكانيًا غير موثق."
                  : "Le VO₂max est une estimation, pas une mesure en laboratoire. La plateforme affiche le résultat et le calcul sans appliquer de classement de population non vérifié."}
              </p>
            </aside>
          </div>
        </section>
      )}

      {/* Interactive Score Entry / Results Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
        <div className="border-b border-border bg-muted/20 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-foreground">{t("table.playerRoster")} ({players.length})</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {sessionStatus === "DRAFT" ? t("sheet.liveDraftMode") : t("sheet.officialResultsMode")}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                {sessionStatus === "COMPLETED" && <th className="px-4 py-3 text-start">{t("table.rank")}</th>}
                <th className="px-4 py-3 text-start">{t("table.player")}</th>
                <th className="px-4 py-3 text-start">{t("table.status")}</th>
                {isYoYo && (
                  <>
                    <th className="px-4 py-3 text-start">{t("fields.level")}</th>
                    <th className="px-4 py-3 text-start">{t("fields.shuttle")}</th>
                    <th className="px-4 py-3 text-start">{t("fields.distance")}</th>
                    <th className="px-4 py-3 text-start">{locale === "ar" ? "VO₂ تقديري" : "VO₂ estimé"}</th>
                  </>
                )}
                {isSprint && (
                  <>
                    <th className="px-4 py-3 text-start">{t("fields.timeAttempt1")}</th>
                    <th className="px-4 py-3 text-start">{t("fields.timeAttempt2")}</th>
                    <th className="px-4 py-3 text-start">{t("fields.bestTime")}</th>
                  </>
                )}
                {isJump && (
                  <>
                    <th className="px-4 py-3 text-start">{t("fields.heightAttempt1")}</th>
                    <th className="px-4 py-3 text-start">{t("fields.heightAttempt2")}</th>
                    <th className="px-4 py-3 text-start">{t("fields.bestHeight")}</th>
                  </>
                )}
                {sessionStatus === "COMPLETED" && canCorrect && (
                  <th className="px-4 py-3 text-end print:hidden">{t("table.actions")}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((p) => {
                const curLevel = Number(p.measurements.level || (isYoYoIR2 ? 11 : 5));
                const curShuttle = Number(p.measurements.shuttle || 1);
                const levelInfo = yoYoLevels.find((l) => l.level === curLevel) || yoYoLevels[0]!;

                return (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                    {/* Rank for completed sessions */}
                    {sessionStatus === "COMPLETED" && (
                      <td className="px-4 py-3 font-bold text-foreground">
                        {p.rank ? (
                          <div className="flex items-center gap-1 font-mono">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-black ${
                                p.rank === 1
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                  : p.rank === 2
                                  ? "bg-slate-400/15 text-slate-700 dark:text-slate-300 border border-slate-400/30"
                                  : p.rank === 3
                                  ? "bg-amber-700/15 text-amber-800 dark:text-amber-500 border border-amber-700/30"
                                  : "text-muted-foreground"
                              }`}
                            >
                              #{p.rank}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}

                    {/* Player Info */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-bold text-xs text-foreground shrink-0 border border-border">
                          {p.shirtNumber ? `#${p.shirtNumber}` : p.firstName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-foreground text-sm leading-tight">
                              {getPlayerDisplayName(p, locale)}
                            </p>
                            {p.isCorrected && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                                {t("isCorrected")}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{p.position}</p>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {sessionStatus === "DRAFT" ? (
                        <>
                          <select
                            value={p.status}
                            onChange={(e) => handleStatusChange(p.id, e.target.value as any)}
                            className="print:hidden rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-hidden"
                          >
                            <option value="VALID">{t("status.valid")}</option>
                            <option value="INCOMPLETE">{t("status.incomplete")}</option>
                            <option value="DISQUALIFIED">{t("status.disqualified")}</option>
                            <option value="ABSENT">{t("status.absent")}</option>
                          </select>
                          <span className="hidden print:inline text-xs font-semibold text-black">
                            {t(`status.${p.status.toLowerCase()}` as any)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground print:text-black">
                          {t(`status.${p.status.toLowerCase()}` as any)}
                        </span>
                      )}
                    </td>

                    {/* Yo-Yo IR1 / IR2 Fields */}
                    {isYoYo && (
                      <>
                        <td className="px-4 py-3">
                          {sessionStatus === "DRAFT" && (p.status === "VALID" || p.status === "INCOMPLETE") ? (
                            <>
                              <select
                                value={curLevel}
                                onChange={(e) => handleYoYoChange(p.id, "level", Number(e.target.value))}
                                className="print:hidden rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground focus:outline-hidden"
                              >
                                {yoYoLevels.map((lvl) => (
                                  <option key={lvl.level} value={lvl.level}>
                                    {locale === "ar" ? `المستوى ${lvl.level} (${lvl.speedKmh} كم/س)` : `Niveau ${lvl.level} (${lvl.speedKmh} km/h)`}
                                  </option>
                                ))}
                              </select>
                              <span className="hidden print:inline font-bold text-xs text-black">
                                {locale === "ar" ? `المستوى ${curLevel}` : `Niveau ${curLevel}`}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-foreground print:text-black">
                              {p.measurements.level ? (locale === "ar" ? `المستوى ${p.measurements.level}` : `Niveau ${p.measurements.level}`) : "—"}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {sessionStatus === "DRAFT" && (p.status === "VALID" || p.status === "INCOMPLETE") ? (
                            <>
                              <select
                                value={curShuttle}
                                onChange={(e) => handleYoYoChange(p.id, "shuttle", Number(e.target.value))}
                                className="print:hidden rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground focus:outline-hidden"
                              >
                                {Array.from({ length: levelInfo.shuttlesInLevel }, (_, i) => i + 1).map((s) => (
                                  <option key={s} value={s}>
                                    Shuttle {s} / {levelInfo.shuttlesInLevel}
                                  </option>
                                ))}
                              </select>
                              <span className="hidden print:inline font-bold text-xs text-black">
                                {locale === "ar" ? `ذهاب وإياب ${curShuttle}` : `Navette ${curShuttle}`}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-foreground print:text-black">
                              {p.measurements.shuttle ? `Shuttle ${p.measurements.shuttle}` : "—"}
                            </span>
                          )}
                        </td>

                        {(() => {
                          const dist = p.status === "VALID" ? Number(p.summaryScore ?? p.measurements.distance ?? getYoYoDistance(curLevel, curShuttle)) : null;
                          const vo2 = p.status === "VALID" ? Number(p.secondaryScore ?? p.measurements.vo2max ?? (dist ? getYoYoVO2max(dist) : null)) : null;
                          return (
                            <>
                              <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 print:text-black text-xs">
                                {dist != null ? `${dist.toLocaleString()} m` : "—"}
                              </td>

                              <td className="px-4 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400 print:text-black text-xs">
                                {vo2 != null ? `${vo2}` : "—"}
                              </td>

                            </>
                          );
                        })()}
                      </>
                    )}

                    {/* Sprint Fields */}
                    {isSprint && (
                      <>
                        <td className="px-4 py-3">
                          {sessionStatus === "DRAFT" ? (
                            <>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="4.15"
                                value={p.measurements.time_1 ?? ""}
                                onChange={(e) => handleGenericChange(p.id, "time_1", e.target.value)}
                                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono print:hidden"
                              />
                              <span className="hidden print:inline font-mono text-xs">{formatMeasurement(p.measurements.time_1, "s")}</span>
                            </>
                          ) : (
                            <span className="font-mono text-xs">{formatMeasurement(p.measurements.time_1, "s")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sessionStatus === "DRAFT" ? (
                            <>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="4.08"
                                value={p.measurements.time_2 ?? ""}
                                onChange={(e) => handleGenericChange(p.id, "time_2", e.target.value)}
                                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono print:hidden"
                              />
                              <span className="hidden print:inline font-mono text-xs">{formatMeasurement(p.measurements.time_2, "s")}</span>
                            </>
                          ) : (
                            <span className="font-mono text-xs">{formatMeasurement(p.measurements.time_2, "s")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-600 text-xs">
                          {formatMeasurement(p.summaryScore, "s")}
                        </td>
                      </>
                    )}

                    {/* Vertical Jump Fields */}
                    {isJump && (
                      <>
                        <td className="px-4 py-3">
                          {sessionStatus === "DRAFT" ? (
                            <>
                              <input
                                type="number"
                                step="0.5"
                                placeholder="48.0"
                                value={p.measurements.height_1 ?? ""}
                                onChange={(e) => handleGenericChange(p.id, "height_1", e.target.value)}
                                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono print:hidden"
                              />
                              <span className="hidden print:inline font-mono text-xs">{formatMeasurement(p.measurements.height_1, "cm")}</span>
                            </>
                          ) : (
                            <span className="font-mono text-xs">{formatMeasurement(p.measurements.height_1, "cm")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sessionStatus === "DRAFT" ? (
                            <>
                              <input
                                type="number"
                                step="0.5"
                                placeholder="51.5"
                                value={p.measurements.height_2 ?? ""}
                                onChange={(e) => handleGenericChange(p.id, "height_2", e.target.value)}
                                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono print:hidden"
                              />
                              <span className="hidden print:inline font-mono text-xs">{formatMeasurement(p.measurements.height_2, "cm")}</span>
                            </>
                          ) : (
                            <span className="font-mono text-xs">{formatMeasurement(p.measurements.height_2, "cm")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-600 text-xs">
                          {formatMeasurement(p.summaryScore, "cm")}
                        </td>
                      </>
                    )}

                    {/* Correction Action for Completed Sessions */}
                    {sessionStatus === "COMPLETED" && canCorrect && (
                      <td className="px-4 py-3 text-end print:hidden">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCorrectionDialog(p)}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>{t("actions.correctResult")}</span>
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audited Correction Modal */}
      {correctionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-amber-600" />
                <span>{t("correctionModal.title")}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {getPlayerDisplayName(correctionTarget, locale)} — {protocolName}
              </p>
            </div>

            {/* Current Measurements */}
            {isYoYo && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">{t("fields.level")}</label>
                  <select
                    value={correctionMeasurements.level || (isYoYoIR2 ? 11 : 5)}
                    onChange={(e) =>
                      setCorrectionMeasurements((m) => {
                        const level = Number(e.target.value);
                        const maxShuttle = yoYoLevels.find((item) => item.level === level)?.shuttlesInLevel ?? 1;
                        return { ...m, level, shuttle: Math.min(Number(m.shuttle || 1), maxShuttle) };
                      })
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                  >
                    {yoYoLevels.map((lvl) => (
                      <option key={lvl.level} value={lvl.level}>
                        {locale === "ar" ? `المستوى ${lvl.level} (${lvl.speedKmh} كم/س)` : `Niveau ${lvl.level} (${lvl.speedKmh} km/h)`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">{t("fields.shuttle")}</label>
                  <select
                    value={correctionMeasurements.shuttle || 1}
                    onChange={(e) =>
                      setCorrectionMeasurements((m) => ({ ...m, shuttle: Number(e.target.value) }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground font-mono"
                  >
                    {Array.from({ length: yoYoLevels.find((item) => item.level === Number(correctionMeasurements.level || (isYoYoIR2 ? 11 : 5)))?.shuttlesInLevel ?? 1 }, (_, index) => index + 1).map((shuttle) => (
                      <option key={shuttle} value={shuttle}>{shuttle}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Audit Reason */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("correctionModal.mandatoryReason")}
              </label>
              <textarea
                rows={2}
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder={t("correctionModal.reasonPlaceholder")}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("correctionModal.auditNotice")}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCorrectionTarget(null)}
                disabled={isPending}
              >
                {t("actions.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={submitCorrection}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {t("actions.saveCorrection")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Coach AI Assistant Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-purple-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {locale === "ar" ? "المساعد الذكي للمدرب في الجوانب الرياضية والبدنية" : "Assistant IA du staff technique"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {sessionTitle} — {protocolName}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAiModal(false)}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            {isAiLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-sm font-semibold text-foreground">
                  {locale === "ar" ? "جارٍ تحليل مؤشرات الجهد البدني والقدرة الهوائية..." : "Analyse physiologique en cours par l'IA..."}
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {locale === "ar" ? "تحليل إرشادي لنتائج الجلسة المسجلة؛ راجع الحسابات مع المدرب" : "Analyse indicative des résultats saisis ; à vérifier avec le préparateur."}
                </p>
              </div>
            ) : aiReport ? (
              <div className="space-y-4 text-xs">
                {/* AI Model Badge */}
                <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2 text-purple-800 dark:text-purple-300">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Brain className="h-4 w-4" />
                    <span>{aiReport.summary}</span>
                  </div>
                  <Badge tone="neutral" className="text-[10px] font-mono">
                    {aiReport.aiProviderUsed === "LOCAL_OLLAMA" ? "Ollama Local AI" : (locale === "ar" ? "ملخص آلي وصفي" : "Résumé descriptif automatique")}
                  </Badge>
                </div>

                <section className="rounded-xl border border-border bg-background p-4 space-y-3">
                  <h4 className="font-bold text-foreground">{locale === "ar" ? "ملخص القياسات الصالحة" : "Synthèse des mesures valides"}</h4>
                  {aiReport.metrics.length ? <div className="overflow-x-auto">
                    <table className="w-full text-start">
                      <thead><tr className="text-muted-foreground border-b border-border">
                        <th className="py-2 pe-3">{locale === "ar" ? "المؤشر" : "Mesure"}</th>
                        <th className="py-2 px-2">{locale === "ar" ? "العدد" : "N"}</th>
                        <th className="py-2 px-2">{locale === "ar" ? "المتوسط" : "Moyenne"}</th>
                        <th className="py-2 px-2">{locale === "ar" ? "الأدنى" : "Min."}</th>
                        <th className="py-2 ps-2">{locale === "ar" ? "الأعلى" : "Max."}</th>
                      </tr></thead>
                      <tbody>{aiReport.metrics.map((metric, index) => <tr key={`${metric.label}-${index}`} className="border-b last:border-0 border-border/60">
                        <td className="py-2 pe-3 font-medium">{metric.label}</td>
                        <td className="py-2 px-2">{metric.count}</td>
                        {[metric.average, metric.minimum, metric.maximum].map((value, valueIndex) => <td key={valueIndex} className="py-2 px-2">{value == null ? "—" : `${value} ${metric.unit}`}</td>)}
                      </tr>)}</tbody>
                    </table>
                    <p className="mt-2 text-[11px] text-muted-foreground">{locale === "ar" ? "إحصاءات وصفية للنتائج المدخلة فقط؛ لا تمثل معياراً أو حكماً على الأداء." : "Statistiques descriptives des résultats saisis ; elles ne constituent ni une norme ni un jugement de performance."}</p>
                  </div> : <p className="text-muted-foreground">{locale === "ar" ? "لا توجد نتائج رقمية صالحة للحساب." : "Aucun résultat numérique valide à calculer."}</p>}
                </section>

                {/* Executive Diagnosis */}
                <div className="rounded-xl border border-border bg-background p-4 space-y-2">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-emerald-600" />
                    <span>{locale === "ar" ? "ملاحظات إرشادية للمدرب" : "Observations indicatives pour l’entraîneur"}</span>
                  </h4>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-foreground whitespace-pre-wrap leading-relaxed text-xs">
                    {aiReport.executiveDiagnosis}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {locale === "ar" ? "مخرجات الذكاء الاصطناعي إرشادية؛ القياسات المحفوظة ناتجة عن مدخلات المدرب والحسابات المحددة للبروتوكول." : "Les remarques de l’IA sont indicatives ; les mesures enregistrées proviennent des saisies et calculs définis pour le protocole."}
                  </p>
                </div>

                {aiReport.keyFindings?.length > 0 && <ul className="list-disc list-inside text-muted-foreground">
                  {aiReport.keyFindings.map((finding: string, idx: number) => <li key={idx}>{finding}</li>)}
                </ul>}

                {/* Coach checks */}
                {aiReport.coachRecommendations && aiReport.coachRecommendations.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                    <h4 className="font-bold text-foreground">
                      {locale === "ar" ? "نقاط تحقق للمدرب:" : "Points à vérifier par l’entraîneur :"}
                    </h4>
                    <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
                      {aiReport.coachRecommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="leading-relaxed">
                          <span className="text-foreground">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : <div className="py-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">{locale === "ar" ? "تعذر إنشاء التقرير. تحقق من الاتصال ثم أعد المحاولة." : "Impossible de générer le rapport. Vérifiez la connexion puis réessayez."}</p>
              <Button size="sm" onClick={handleOpenAIAssistant}>{locale === "ar" ? "إعادة المحاولة" : "Réessayer"}</Button>
            </div>}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAIAssistant}
                disabled={isAiLoading}
              >
                {locale === "ar" ? "تحديث التحليل" : "Actualiser l’analyse"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAiModal(false)}
              >
                {tCommon("close")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Official printable signature block (visible only when printing) */}
      <div
        className="hidden print:grid grid-cols-3 text-[14px] sm:text-[15px] pt-8 mt-10 text-black"
        style={{ fontFamily: "'Traditional Arabic', 'Arabic Typesetting', serif" }}
      >
        <div>
          <p className="font-bold text-[14px] sm:text-[15px]">
            {locale === "ar" ? "المعد البدني" : "Le Préparateur Physique"}
          </p>
          <div className="h-16" />
        </div>
        <div className="text-center">
          <p className="font-bold text-[14px] sm:text-[15px]">
            {locale === "ar" ? "طبيب النادي / الطاقم الطبي" : "Le Médecin du Club"}
          </p>
          <div className="h-16" />
        </div>
        <div className="text-end">
          <p className="font-bold text-[14px] sm:text-[15px]">
            {locale === "ar" ? "المدير الفني / المدرب الرئيسي" : "L'Entraîneur Principal / DTN"}
          </p>
          <div className="h-16" />
        </div>
      </div>

      {/* Printable report of the recorded results */}
      <OfficialTestingReportModal
        isOpen={showOfficialReportModal}
        onClose={() => setShowOfficialReportModal(false)}
        session={{
          id: sessionId,
          title: sessionTitle,
          date: date || new Date(),
          location: location || "الملعب البلدي - سيدي حسني",
          protocolName,
          protocolCode,
          teamName: teamName || "الفريق",
          teamCategory: teamCategory || "SENIOR",
          conductorName: conductorName || "الطاقم الفني والإعداد البدني"
        }}
        players={data}
        locale={locale}
      />
    </div>
  );
}
