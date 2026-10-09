"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useTranslations } from "next-intl";
import { SafeImage } from "@/components/shared/safe-image";
import { audioEngine } from "@/lib/testing/audio-engine";
import {
  deriveConductorState,
  formatLevelShuttle,
  COUNTDOWN_DURATION_SEC,
  YOYO_IR1_FULL_SCHEDULE,
  type ConductorState
} from "@/lib/testing/protocols/yoyo-conductor-engine";
import {
  calculateYoYoDistance,
  calculateYoYoVO2max,
  YOYO_IR1_LEVELS
} from "@/lib/testing/protocols/yoyo-ir1";
import {
  saveSessionMeasurementsAction,
  completeTestSessionAction
} from "@/app/[locale]/(dashboard)/dashboard/testing/actions";
import { formatMeasurement } from "@/lib/testing/formatters";
import { localizedFootballPosition } from "@/lib/public/locale-text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Timer,
  AlertTriangle,
  Users,
  CheckCircle2,
  Save,
  RotateCcw,
  Trophy,
  ArrowRight,
  ArrowLeft,
  Volume1,
  FileText,
  Activity,
  Clock,
  Award
} from "lucide-react";
import type { SessionPlayerData } from "./testing-session-sheet";

interface YoYoConductorProps {
  sessionId: string;
  sessionTitle: string;
  players: SessionPlayerData[];
  canManage: boolean;
  locale: string;
  onSwitchToManual: (updatedRunners?: RunnerState[]) => void;
}

export interface RunnerState {
  playerId: string;
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  position: string;
  photoUrl: string | null;
  status: "ACTIVE" | "STOPPED" | "WITHDRAWN" | "ABSENT";
  warnings: number;
  level: number | null;
  shuttle: number | null;
  distance: number | null;
  vo2max: number | null;
  scoreDisplay: string | null;
  notes: string | null;
}

export function YoYoConductor({
  sessionId,
  sessionTitle,
  players,
  canManage,
  locale,
  onSwitchToManual
}: YoYoConductorProps) {
  const t = useTranslations("testing");
  const tCommon = useTranslations("common");

  // Running clock state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [conductorState, setConductorState] = useState<ConductorState>(() => deriveConductorState(-1));
  const [audioReady, setAudioReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Persistence / transition state
  const [isPending, startTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Runners tracking state
  const [runners, setRunners] = useState<RunnerState[]>(() => {
    return players.map((p) => {
      const rawLvl = p.measurements?.level;
      const rawSht = p.measurements?.shuttle;
      const hasExplicitMeasurements =
        rawLvl !== undefined && rawLvl !== null && rawLvl !== "" &&
        rawSht !== undefined && rawSht !== null && rawSht !== "";

      const lvl = hasExplicitMeasurements ? Number(rawLvl) : null;
      const sht = hasExplicitMeasurements ? Number(rawSht) : null;

      // Player is only considered stopped if they already have recorded results in DB
      const isStoppedAlready =
        p.status === "VALID" &&
        hasExplicitMeasurements &&
        (!!p.resultId || (typeof p.summaryScore === "number" && p.summaryScore > 0));

      let distance = p.measurements?.distance ? Number(p.measurements.distance) : null;
      if (!distance && lvl !== null && sht !== null) {
        try {
          distance = calculateYoYoDistance(lvl, sht);
        } catch {
          distance = null;
        }
      }
      const vo2 = distance ? calculateYoYoVO2max(distance) : null;

      return {
        playerId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        shirtNumber: p.shirtNumber,
        position: p.position,
        photoUrl: p.photoUrl,
        status: p.status === "ABSENT" ? "ABSENT" : isStoppedAlready ? "STOPPED" : "ACTIVE",
        warnings: 0,
        level: isStoppedAlready ? lvl : null,
        shuttle: isStoppedAlready ? sht : null,
        distance: isStoppedAlready ? distance : null,
        vo2max: isStoppedAlready ? vo2 : null,
        scoreDisplay: isStoppedAlready && lvl && sht ? formatLevelShuttle(lvl, sht) : null,
        notes: p.notes ?? null
      };
    });
  });

  // Keep runners in sync when players prop changes from draft saves or server refetches
  useEffect(() => {
    setRunners((prev) => {
      const prevMap = new Map(prev.map((r) => [r.playerId, r]));
      return players.map((p) => {
        const existing = prevMap.get(p.id);
        if (existing && (existing.status === "STOPPED" || existing.warnings > 0)) {
          return existing;
        }
        const rawLvl = p.measurements?.level;
        const rawSht = p.measurements?.shuttle;
        const hasExplicitMeasurements =
          rawLvl !== undefined && rawLvl !== null && rawLvl !== "" &&
          rawSht !== undefined && rawSht !== null && rawSht !== "";

        const lvl = hasExplicitMeasurements ? Number(rawLvl) : null;
        const sht = hasExplicitMeasurements ? Number(rawSht) : null;

        const isStoppedAlready =
          p.status === "VALID" &&
          hasExplicitMeasurements &&
          (!!p.resultId || (typeof p.summaryScore === "number" && p.summaryScore > 0));

        let distance = p.measurements?.distance ? Number(p.measurements.distance) : null;
        if (!distance && lvl !== null && sht !== null) {
          try {
            distance = calculateYoYoDistance(lvl, sht);
          } catch {
            distance = null;
          }
        }
        const vo2 = distance ? calculateYoYoVO2max(distance) : null;

        return {
          playerId: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          shirtNumber: p.shirtNumber,
          position: p.position,
          photoUrl: p.photoUrl,
          status: p.status === "ABSENT" ? "ABSENT" : isStoppedAlready ? "STOPPED" : "ACTIVE",
          warnings: existing?.warnings ?? 0,
          level: existing?.level ?? (isStoppedAlready ? lvl : null),
          shuttle: existing?.shuttle ?? (isStoppedAlready ? sht : null),
          distance: existing?.distance ?? (isStoppedAlready ? distance : null),
          vo2max: existing?.vo2max ?? (isStoppedAlready ? vo2 : null),
          scoreDisplay: existing?.scoreDisplay ?? (isStoppedAlready && lvl && sht ? formatLevelShuttle(lvl, sht) : null),
          notes: p.notes ?? null
        };
      });
    });
  }, [players]);

  // Timing references for drift-free monotonic calculation
  const startPerformanceRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastUiUpdateRef = useRef<number>(0);
  const lastUiPhaseRef = useRef<ConductorState["phase"]>("NOT_STARTED");
  const lastUiShuttleIndexRef = useRef<number>(0);

  // Audio cue debouncing references
  const lastPhaseRef = useRef<string>("NOT_STARTED");
  const lastShuttleIndexRef = useRef<number>(0);
  const halfwayPlayedRef = useRef<boolean>(false);
  const countdownBeepsPlayedRef = useRef<Set<number>>(new Set());
  const recoveryBeepsPlayedRef = useRef<Set<number>>(new Set());

  // Toggle Mute
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioEngine.setMuted(next);
  };

  // Change Volume
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    audioEngine.setVolume(newVol);
  };

  // Test Audio tone
  const handleTestAudio = async () => {
    const res = await audioEngine.init();
    if (res.success) {
      setAudioReady(true);
      setAudioError(null);
      audioEngine.playStartTone();
    } else {
      setAudioError(res.error || "Audio initialization failed");
    }
  };

  // Start Test (unlocks AudioContext & begins monotonic timer)
  const handleStartTest = async () => {
    setAudioError(null);
    const audioRes = await audioEngine.init();
    if (!audioRes.success) {
      setAudioError(audioRes.error || "Could not unlock browser audio.");
      return;
    }
    setAudioReady(true);

    startPerformanceRef.current = performance.now();
    lastUiUpdateRef.current = 0;
    lastUiPhaseRef.current = "NOT_STARTED";
    lastUiShuttleIndexRef.current = 0;
    totalPausedMsRef.current = 0;
    pausedAtRef.current = null;
    countdownBeepsPlayedRef.current.clear();
    recoveryBeepsPlayedRef.current.clear();
    halfwayPlayedRef.current = false;
    lastPhaseRef.current = "NOT_STARTED";
    lastShuttleIndexRef.current = 0;

    setElapsedSec(0);
    setConductorState(deriveConductorState(-1));
    setIsRunning(true);
    setIsPaused(false);
  };

  // Administrative Pause / Resume
  const handleTogglePause = () => {
    if (!isRunning) return;
    if (isPaused) {
      // Resuming
      if (pausedAtRef.current !== null) {
        totalPausedMsRef.current += performance.now() - pausedAtRef.current;
        pausedAtRef.current = null;
      }
      setIsPaused(false);
    } else {
      // Pausing
      pausedAtRef.current = performance.now();
      setIsPaused(true);
    }
  };

  // Monotonic Tick Loop with Audio Cue Triggering
  const tick = useCallback(() => {
    if (!isRunning || isPaused || startPerformanceRef.current === null) return;

    const now = performance.now();
    const currentElapsedSec = Math.max(
      0,
      (now - startPerformanceRef.current - totalPausedMsRef.current) / 1000
    );

    const state = deriveConductorState(currentElapsedSec);
    const shuttleIndex = state.currentShuttle?.shuttleIndex ?? 0;
    if (
      now - lastUiUpdateRef.current >= 100 ||
      state.phase !== lastUiPhaseRef.current ||
      shuttleIndex !== lastUiShuttleIndexRef.current
    ) {
      lastUiUpdateRef.current = now;
      lastUiPhaseRef.current = state.phase;
      lastUiShuttleIndexRef.current = shuttleIndex;
      setElapsedSec(currentElapsedSec);
      setConductorState(state);
    }

    // Audio Cue Checks
    if (state.phase === "COUNTDOWN") {
      const remainingInt = Math.ceil(state.phaseRemainingSec);
      if (remainingInt <= 3 && remainingInt >= 1 && !countdownBeepsPlayedRef.current.has(remainingInt)) {
        countdownBeepsPlayedRef.current.add(remainingInt);
        audioEngine.playCountdownTone();
      }
    } else if (state.phase === "SHUTTLE_RUNNING") {
      // Check if newly transitioned to this shuttle
      if (state.currentShuttle && state.currentShuttle.shuttleIndex !== lastShuttleIndexRef.current) {
        lastShuttleIndexRef.current = state.currentShuttle.shuttleIndex;
        halfwayPlayedRef.current = false;
        recoveryBeepsPlayedRef.current.clear();

        if (state.currentShuttle.isLevelStart) {
          audioEngine.playLevelChangeTone();
          audioEngine.speak(`${t("conductor.level")} ${state.activeLevel}`, locale);
        } else {
          audioEngine.playStartTone();
        }
      }

      // Check halfway 20m turnaround cue
      if (
        state.currentShuttle &&
        state.phaseElapsedSec >= state.currentShuttle.halfwaySec &&
        !halfwayPlayedRef.current
      ) {
        halfwayPlayedRef.current = true;
        audioEngine.playTurnaroundTone();
      }
    } else if (state.phase === "RECOVERY") {
      if (lastPhaseRef.current !== "RECOVERY") {
        audioEngine.playShuttleEndTone();
      }

      // Recovery countdown cues at 5s, 3s, 2s, 1s remaining
      const recoveryRemainingInt = Math.ceil(state.phaseRemainingSec);
      if (
        [5, 3, 2, 1].includes(recoveryRemainingInt) &&
        !recoveryBeepsPlayedRef.current.has(recoveryRemainingInt)
      ) {
        recoveryBeepsPlayedRef.current.add(recoveryRemainingInt);
        audioEngine.playRecoveryWarningTone();
      }
    }

    lastPhaseRef.current = state.phase;

    if (state.isCompleted) {
      setIsRunning(false);
      audioEngine.playLevelChangeTone();
    } else {
      animFrameRef.current = requestAnimationFrame(tick);
    }
  }, [isRunning, isPaused, locale, t]);

  useEffect(() => {
    if (isRunning && !isPaused) {
      animFrameRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isRunning, isPaused, tick]);

  // Player action: toggle first warning
  const handleToggleWarning = (playerId: string) => {
    setRunners((prev) =>
      prev.map((r) =>
        r.playerId === playerId
          ? { ...r, warnings: r.warnings === 0 ? 1 : 0 }
          : r
      )
    );
  };

  const getMostRecentlyCompletedShuttle = () => {
    const current = conductorState.currentShuttle;
    if (!current) return null;
    if (conductorState.phase === "RECOVERY" || conductorState.phase === "COMPLETED") return current;
    if (conductorState.phase === "SHUTTLE_RUNNING" && current.shuttleIndex > 1) {
      return YOYO_IR1_FULL_SCHEDULE[current.shuttleIndex - 2] ?? null;
    }
    return null;
  };

  // Only credit shuttles that the protocol has actually completed.
  const handleStopPlayer = (playerId: string) => {
    const completedShuttle = getMostRecentlyCompletedShuttle();
    if (!completedShuttle) return;
    const finalLevel = completedShuttle.level;
    const finalShuttle = completedShuttle.shuttleInLevel;

    const distance = calculateYoYoDistance(finalLevel, finalShuttle);
    const vo2 = calculateYoYoVO2max(distance);
    const scoreDisplay = formatLevelShuttle(finalLevel, finalShuttle);

    setRunners((prev) =>
      prev.map((r) =>
        r.playerId === playerId
          ? {
              ...r,
              status: "STOPPED",
              level: finalLevel,
              shuttle: finalShuttle,
              distance,
              vo2max: vo2,
              scoreDisplay
            }
          : r
      )
    );
  };

  // Quick adjust for stopped player (in case coach tapped by mistake)
  const handleAdjustStopped = (playerId: string, deltaShuttle: number) => {
    setRunners((prev) =>
      prev.map((r) => {
        if (r.playerId !== playerId || r.level === null || r.shuttle === null) return r;
        const levelInfo = YOYO_IR1_LEVELS.find((l) => l.level === r.level) || YOYO_IR1_LEVELS[0]!;
        const newShuttle = Math.min(Math.max(1, r.shuttle + deltaShuttle), levelInfo.shuttlesInLevel);
        const distance = calculateYoYoDistance(r.level, newShuttle);
        const vo2 = calculateYoYoVO2max(distance);
        return {
          ...r,
          shuttle: newShuttle,
          distance,
          vo2max: vo2,
          scoreDisplay: formatLevelShuttle(r.level, newShuttle)
        };
      })
    );
  };

  // Stop all currently active runners at current level/shuttle
  const handleStopAllRemaining = () => {
    const completedShuttle = getMostRecentlyCompletedShuttle();
    if (!completedShuttle) return;
    const curLevel = completedShuttle.level;
    const curShuttle = completedShuttle.shuttleInLevel;
    const distance = calculateYoYoDistance(curLevel, curShuttle);
    const vo2 = calculateYoYoVO2max(distance);
    const scoreDisplay = formatLevelShuttle(curLevel, curShuttle);

    setRunners((prev) =>
      prev.map((r) =>
        r.status === "ACTIVE"
          ? {
              ...r,
              status: "STOPPED",
              level: curLevel,
              shuttle: curShuttle,
              distance,
              vo2max: vo2,
              scoreDisplay
            }
          : r
      )
    );
  };

  // Mark player absent or withdrawn
  const handleMarkStatus = (playerId: string, status: "WITHDRAWN" | "ABSENT") => {
    setRunners((prev) =>
      prev.map((r) => (r.playerId === playerId ? { ...r, status } : r))
    );
  };

  // Re-activate player
  const handleReactivate = (playerId: string) => {
    setRunners((prev) =>
      prev.map((r) =>
        r.playerId === playerId
          ? {
              ...r,
              status: "ACTIVE",
              level: null,
              shuttle: null,
              distance: null,
              vo2max: null,
              scoreDisplay: null
            }
          : r
      )
    );
  };

  // Helper to serialize runners into measurement entries
  const buildMeasurementEntries = (runnersList: RunnerState[]) => {
    return runnersList.map((r) => {
      let status: "VALID" | "INCOMPLETE" | "DISQUALIFIED" | "ABSENT" = r.status === "STOPPED" ? "VALID" : "INCOMPLETE";
      if (r.status === "ABSENT") status = "ABSENT";

      const measurements: Array<{
        key: string;
        value: string;
        numericValue: number | null;
        unit?: string | null;
        attempt?: number;
      }> = [];

      if (r.level !== null && r.shuttle !== null && r.distance !== null) {
        measurements.push(
          { key: "level", value: String(r.level), numericValue: r.level, unit: "level", attempt: 1 },
          { key: "shuttle", value: String(r.shuttle), numericValue: r.shuttle, unit: "shuttle", attempt: 1 },
          { key: "distance", value: String(r.distance), numericValue: r.distance, unit: "m", attempt: 1 },
          { key: "vo2max", value: String(r.vo2max), numericValue: r.vo2max, unit: "ml/kg/min", attempt: 1 }
        );
      }

      return {
        playerId: r.playerId,
        status,
        measurements,
        notes: r.notes
      };
    });
  };

  // Save current runners measurements as DRAFT without completing the session
  const handleSaveDraft = () => {
    setErrorMessage(null);
    setSaveSuccess(false);

    startTransition(async () => {
      try {
        const entries = buildMeasurementEntries(runners);
        const saveRes = await saveSessionMeasurementsAction(sessionId, entries);
        if (!saveRes.success) {
          throw new Error(saveRes.error || "Failed to save draft measurements");
        }
        setSaveSuccess(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
      }
    });
  };

  // Complete and save official test results atomically to the server
  const handleCompleteAndSave = () => {
    setErrorMessage(null);
    setSaveSuccess(false);
    if (runners.some((runner) => runner.status === "ACTIVE")) {
      setErrorMessage(locale === "ar"
        ? "أوقف كل لاعب بعد آخر شوط مكتمل قبل إنهاء الجلسة."
        : "Arrêtez chaque joueur après sa dernière navette terminée avant de clôturer la séance.");
      return;
    }

    startTransition(async () => {
      try {
        const entries = buildMeasurementEntries(runners);

        const saveRes = await saveSessionMeasurementsAction(sessionId, entries);
        if (!saveRes.success) {
          throw new Error(saveRes.error || "Failed to save measurements");
        }

        const compRes = await completeTestSessionAction(sessionId);
        if (!compRes.success) {
          throw new Error(compRes.error || "Failed to complete test session");
        }

        setSaveSuccess(true);
        audioEngine.close();
        window.location.reload();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
      }
    });
  };

  // Format digital countdown string: mm:ss.d
  const formatTimeDigital = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
  };

  const activeRunners = runners.filter((r) => r.status === "ACTIVE");
  const stoppedRunners = runners
    .filter((r) => r.status === "STOPPED")
    .sort((a, b) => (b.distance || 0) - (a.distance || 0));
  const otherRunners = runners.filter((r) => r.status === "WITHDRAWN" || r.status === "ABSENT");

  const isRtl = locale === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6">
      {/* Notifications & Audio Warnings */}
      {audioError && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 font-medium">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <span>{audioError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestAudio}
            className="ms-auto h-7 text-xs bg-white"
          >
            {t("conductor.testAudio")}
          </Button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 font-medium">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 font-medium">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{t("conductor.allRunnersFinished")}</span>
        </div>
      )}

      {/* Top Conductor Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4 shadow-xs gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold font-mono text-sm">
            IR1
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              {t("conductor.title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {sessionTitle} — {locale === "ar" ? "بروتوكول بانغسبو (2 × 20 م، واستراحة نشطة 10 ثوانٍ)" : "Protocole de Bangsbo (2 × 20 m, récupération active de 10 s)"}
            </p>
          </div>
        </div>

        {/* Audio & Master Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mute/Unmute */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleMute}
            className="h-9 px-3 text-xs"
            title={isMuted ? t("conductor.soundMuted") : t("conductor.soundEnabled")}
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-red-500" /> : <Volume2 className="h-4 w-4 text-emerald-600" />}
          </Button>

          {/* Volume Slider */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 bg-muted/40 rounded-lg h-9">
            <Volume1 className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 h-1.5 accent-emerald-600 cursor-pointer"
            />
          </div>

          {/* Switch to Manual Entry */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSwitchToManual(runners)}
            className="h-9 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{t("conductor.modeSheet")}</span>
          </Button>

          {/* Test Audio Button (if not started) */}
          {!isRunning && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestAudio}
              className="h-9 text-xs flex items-center gap-1.5"
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span>{t("conductor.testAudio")}</span>
            </Button>
          )}

          {/* Master Start / Pause / Resume / Save Buttons */}
          {canManage && (
            <>
              {!isRunning ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveDraft}
                    disabled={isPending}
                    className="h-9 text-xs flex items-center gap-1.5"
                  >
                    <Save className="h-4 w-4" />
                    <span>{t("conductor.saveDraft")}</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleStartTest}
                    className="h-9 bg-club-primary hover:bg-club-primary-hover text-white font-semibold text-xs flex items-center gap-2 px-4 shadow-sm"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>{t("conductor.startTest")}</span>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTogglePause}
                    className="h-9 text-xs flex items-center gap-1.5"
                  >
                    {isPaused ? (
                      <>
                        <Play className="h-3.5 w-3.5 text-emerald-600 fill-current" />
                        <span>{t("conductor.resumeTest")}</span>
                      </>
                    ) : (
                      <>
                        <Pause className="h-3.5 w-3.5 text-amber-600 fill-current" />
                        <span>{t("conductor.pauseTest")}</span>
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveDraft}
                    disabled={isPending}
                    className="h-9 text-xs flex items-center gap-1.5"
                  >
                    <Save className="h-4 w-4" />
                    <span>{t("conductor.saveDraft")}</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCompleteAndSave}
                    disabled={isPending || activeRunners.length > 0}
                    title={activeRunners.length > 0 ? (locale === "ar" ? "أوقف اللاعبين أولًا لتسجيل نتيجة كل لاعب بدقة" : "Stop all active players before completing") : undefined}
                    className="h-9 bg-club-primary hover:bg-club-primary-hover text-white font-semibold text-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{isPending ? tCommon("loading") : t("conductor.saveAndComplete")}</span>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Large-Format Digital Scoreboard Panel */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-gradient-to-b from-card to-muted/20 p-6 shadow-sm">
        {/* Active Phase Banner */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-6">
          <div className="flex items-center gap-2">
            {conductorState.phase === "SHUTTLE_RUNNING" && (
              <Badge className="bg-emerald-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                <Activity className="h-3.5 w-3.5" />
                <span>{t("conductor.runningPhase")}</span>
              </Badge>
            )}
            {conductorState.phase === "RECOVERY" && (
              <Badge className="bg-amber-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5" />
                <span>{t("conductor.recoveryPhase")}</span>
              </Badge>
            )}
            {conductorState.phase === "COUNTDOWN" && (
              <Badge className="bg-blue-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{t("conductor.countdownPhase")}</span>
              </Badge>
            )}
            {conductorState.phase === "NOT_STARTED" && (
              <Badge tone="neutral" className="border border-border text-muted-foreground px-3 py-1 text-xs font-semibold uppercase">
                {t("status.draft")}
              </Badge>
            )}
            {conductorState.phase === "COMPLETED" && (
              <Badge className="bg-emerald-700 text-white px-3 py-1 text-xs font-bold uppercase flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{t("status.completed")}</span>
              </Badge>
            )}

            {isPaused && (
              <Badge tone="danger" className="px-2.5 py-0.5 text-xs font-bold">
                {t("conductor.pauseTest")}
              </Badge>
            )}
          </div>

          <div className="text-xs text-muted-foreground font-mono">
            {t("conductor.elapsedTime")}: <strong className="text-foreground text-sm font-semibold">{formatTimeDigital(elapsedSec)}</strong>
          </div>
        </div>

        {/* Digital Grid: Level, Shuttle, Speed, Countdown to next Beep */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
          {/* Level */}
          <div className="rounded-xl border border-border/80 bg-background/80 p-4 shadow-2xs">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              {t("conductor.level")}
            </span>
            <span className="text-4xl sm:text-5xl font-extrabold text-foreground font-mono mt-1 block">
              {conductorState.activeLevel}
            </span>
            <span className="text-[11px] text-muted-foreground mt-1 block font-medium">
              Yo-Yo IR1
            </span>
          </div>

          {/* Shuttle in Level */}
          <div className="rounded-xl border border-border/80 bg-background/80 p-4 shadow-2xs">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              {t("conductor.shuttle")}
            </span>
            <span className="text-4xl sm:text-5xl font-extrabold text-emerald-600 font-mono mt-1 block">
              {conductorState.activeShuttleInLevel}
              <span className="text-2xl text-muted-foreground font-normal">
                {" "}/ {conductorState.currentShuttle?.totalShuttlesInLevel ?? 1}
              </span>
            </span>
            <span className="text-[11px] text-muted-foreground mt-1 block font-medium">
              40 m (2 × 20 m)
            </span>
          </div>

          {/* Running Speed */}
          <div className="rounded-xl border border-border/80 bg-background/80 p-4 shadow-2xs">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              {t("conductor.currentSpeed")}
            </span>
            <span className="text-4xl sm:text-5xl font-extrabold text-blue-600 font-mono mt-1 block">
              {conductorState.speedKmh.toFixed(1)}
            </span>
            <span className="text-[11px] text-muted-foreground mt-1 block font-medium">
              km/h
            </span>
          </div>

          {/* Next Beep Digital Countdown */}
          <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 p-4 shadow-2xs">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
              {t("conductor.nextBeep")}
            </span>
            <span className="text-4xl sm:text-5xl font-black text-emerald-600 font-mono mt-1 block tracking-tight">
              {formatTimeDigital(conductorState.secondsToNextBeep)}
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold mt-1 block uppercase">
              {conductorState.nextBeepLabel}
            </span>
          </div>
        </div>

        {/* Real-time Smooth Phase Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5 font-medium">
            <span>
              {t("conductor.totalDistance")}: <strong className="text-foreground">{conductorState.cumulativeDistanceMeters.toLocaleString()} m</strong>
            </span>
            <span>
              {conductorState.phaseRemainingSec.toFixed(1)}s / {conductorState.phaseDurationSec.toFixed(1)}s
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden border border-border/60">
            <div
              className={`h-full transition-all duration-100 ease-linear rounded-full ${
                conductorState.phase === "RECOVERY"
                  ? "bg-amber-500"
                  : conductorState.phase === "COUNTDOWN"
                  ? "bg-blue-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, conductorState.progressPercent))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Caution notice when paused */}
      {isPaused && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>{t("conductor.pauseWarning")}</span>
        </div>
      )}

      {/* Multi-Player Interactive Field Tracker */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        {/* Live Active Roster Header */}
        <div className="border-b border-border bg-muted/30 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-foreground">
              {t("table.playerRoster")} ({runners.length})
            </h3>
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              {activeRunners.length} {t("conductor.activeRunners")}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {stoppedRunners.length} {t("conductor.stoppedRunners")}
            </span>
          </div>

          {canManage && runners.length > 0 && (
            <div className="flex items-center gap-2">
              {activeRunners.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStopAllRemaining}
                  disabled={!getMostRecentlyCompletedShuttle()}
                  title={!getMostRecentlyCompletedShuttle() ? (locale === "ar" ? "أكمل شوطًا واحدًا على الأقل أولًا" : "Complete at least one shuttle first") : undefined}
                  className="text-xs h-8 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-1.5"
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>{t("conductor.stopAllRemaining")}</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isPending}
                className="text-xs h-8 flex items-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{t("conductor.saveDraft")}</span>
              </Button>
              {activeRunners.length === 0 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCompleteAndSave}
                  disabled={isPending || activeRunners.length > 0}
                  title={activeRunners.length > 0 ? (locale === "ar" ? "أوقف اللاعبين أولًا لتسجيل نتيجة كل لاعب بدقة" : "Stop all active players before completing") : undefined}
                  className="bg-club-primary hover:bg-club-primary-hover text-white font-bold text-xs h-8 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t("conductor.saveAndComplete")}</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {canManage && activeRunners.length > 0 && (
          <p className="border-b border-border/70 bg-amber-500/[0.04] px-5 py-2 text-[11px] leading-5 text-muted-foreground">
            {locale === "ar"
              ? "أوقف كل لاعب عند خروجه لتسجيل نتيجته حسب آخر شوط مكتمل. إيقاف الجميع يمنحهم نتيجة الشوط نفسه."
              : "Arrêtez chaque joueur à sa sortie pour enregistrer son dernier shuttle terminé. « Arrêter tous » attribue le même shuttle à tous."}
          </p>
        )}

        {/* Section 1: Active In-Race Runners */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase px-2">
            <span>{t("conductor.activeRunners")} ({activeRunners.length})</span>
            <span>{t("table.actions")}</span>
          </div>

          {activeRunners.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground bg-muted/10 rounded-lg border border-dashed border-border">
              {runners.length === 0
                ? "No players assigned to session."
                : t("conductor.allRunnersFinished")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {activeRunners.map((runner) => (
                <div
                  key={runner.playerId}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    runner.warnings > 0
                      ? "border-amber-300 bg-amber-50/40"
                      : "border-border bg-background hover:border-emerald-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative h-10 w-10 shrink-0 overflow-visible">
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-bold text-muted-foreground">
                        {runner.photoUrl ? (
                          <SafeImage src={runner.photoUrl} fallbackSrc="/branding/person-placeholder.svg" alt={`${runner.firstName} ${runner.lastName}`} className="h-full w-full object-cover" />
                        ) : `${runner.firstName.charAt(0)}${runner.lastName.charAt(0)}`}
                      </div>
                      {runner.shirtNumber != null && <span className="absolute -bottom-1 -end-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border border-card bg-club-primary px-1 text-[8px] font-black leading-none text-white shadow-sm ring-1 ring-club-primary/30">{runner.shirtNumber}</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        {runner.firstName} {runner.lastName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {localizedFootballPosition(runner.position, locale)}
                      </p>
                    </div>
                  </div>

                  {/* 1-Tap Action Buttons for Coach */}
                  {canManage && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* 1st Warning toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleWarning(runner.playerId)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors border inline-flex items-center gap-1 ${
                          runner.warnings > 0
                            ? "bg-amber-500 text-white border-amber-600"
                            : "bg-background text-muted-foreground hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300"
                        }`}
                        title="Mark first warning (missed line)"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        <span>{t("conductor.warning1")}</span>
                      </button>

                      {/* Primary 1-Tap STOP button */}
                      <button
                        type="button"
                        onClick={() => handleStopPlayer(runner.playerId)}
                        disabled={!getMostRecentlyCompletedShuttle()}
                        title={!getMostRecentlyCompletedShuttle() ? (locale === "ar" ? "أكمل شوطًا واحدًا على الأقل أولًا" : "Complete at least one shuttle first") : undefined}
                        className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-2xs transition-colors flex items-center gap-1"
                      >
                        <Square className="h-3 w-3 fill-current" />
                        <span>{t("conductor.markStopped")}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Stopped / Completed Players Table */}
        {stoppedRunners.length > 0 && (
          <div className="border-t border-border p-4 bg-muted/10 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase px-2">
              <span className="flex items-center gap-1.5 text-foreground">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                <span>{t("conductor.stoppedRunners")} ({stoppedRunners.length})</span>
              </span>
              <span className="text-[11px] font-normal normal-case">
                Ranked by Distance & Level.Shuttle
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-border/80 text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-3 py-2 text-start">#</th>
                    <th className="px-3 py-2 text-start">{t("table.player")}</th>
                    <th className="px-3 py-2 text-start">Level.Shuttle</th>
                    <th className="px-3 py-2 text-start">{t("conductor.totalDistance")}</th>
                    <th className="px-3 py-2 text-start">VO₂ تقديري</th>
                    {canManage && <th className="px-3 py-2 text-end">{t("table.actions")}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {stoppedRunners.map((runner, index) => (
                    <tr key={runner.playerId} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-bold font-mono">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-black me-1 ${
                            index === 0
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                              : index === 1
                              ? "bg-slate-400/15 text-slate-700 dark:text-slate-300 border border-slate-400/30"
                              : index === 2
                              ? "bg-amber-700/15 text-amber-800 dark:text-amber-500 border border-amber-700/30"
                              : "text-muted-foreground"
                          }`}
                        >
                          #{index + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-foreground">
                        {runner.firstName} {runner.lastName}
                        {runner.shirtNumber && <span className="text-muted-foreground ms-1">(#{runner.shirtNumber})</span>}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-emerald-600 text-sm">
                        {runner.scoreDisplay}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold">
                        {formatMeasurement(runner.distance, "m")}
                      </td>
                      <td className="px-3 py-2 font-mono text-blue-600">
                        {formatMeasurement(runner.vo2max, "ml/kg/min")}
                      </td>
                      {canManage && (
                        <td className="px-3 py-2 text-end">
                          <div className="flex items-center justify-end gap-1">
                            {/* Fast +/- 1 Shuttle Adjustments */}
                            <button
                              type="button"
                              onClick={() => handleAdjustStopped(runner.playerId, -1)}
                              className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-mono"
                              title="Decrease 1 shuttle"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustStopped(runner.playerId, 1)}
                              className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-[11px] font-mono"
                              title="Increase 1 shuttle"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReactivate(runner.playerId)}
                              className="px-2 py-0.5 rounded text-[11px] text-club-primary hover:underline ms-1"
                            >
                              {t("conductor.resumeTest")}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 3: Absent / Withdrawn Players */}
        {otherRunners.length > 0 && (
          <div className="border-t border-border p-4 bg-muted/5 text-xs text-muted-foreground">
            <span className="font-semibold block mb-1">Non-Participants ({otherRunners.length}):</span>
            <div className="flex flex-wrap gap-2">
              {otherRunners.map((r) => (
                <span
                  key={r.playerId}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-[11px]"
                >
                  <span>{r.firstName} {r.lastName}</span>
                  <Badge tone="neutral" className="text-[10px] py-0">
                    {r.status}
                  </Badge>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleReactivate(r.playerId)}
                      className="text-club-primary hover:underline ms-1"
                    >
                      Add
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
