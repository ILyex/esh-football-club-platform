"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  saveBulkAttendanceAction,
  uploadTrainingScannedSheetAction,
  deleteTrainingScannedSheetAction
} from "@/app/[locale]/(dashboard)/dashboard/training/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  ShieldAlert,
  Clock,
  Save,
  Printer,
  Paperclip,
  Upload,
  Download,
  Trash2
} from "lucide-react";
import { OfficialAttendanceSheetModal } from "./official-attendance-sheet-modal";
import { getPlayerDisplayName } from "@/lib/utils";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "INJURED" | "EXCUSED";

export interface AttendancePlayerData {
  id: string;
  firstName: string;
  lastName: string;
  firstNameFr?: string | null;
  lastNameFr?: string | null;
  shirtNumber: number | null;
  position: string;
  currentStatus: AttendanceStatus;
}

export interface TrainingSessionMetadata {
  id: string;
  date: Date | string;
  startTime: Date | string;
  endTime: Date | string;
  teamName: string;
  teamCategory?: string;
  coachName?: string | null;
  location?: string | null;
  status?: string;
  notes?: string | null;
}

export interface ScannedDocumentInfo {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date | string;
}

interface TrainingAttendanceSheetProps {
  sessionId: string;
  players: AttendancePlayerData[];
  canManage: boolean;
  locale: string;
  printOnly?: boolean;
  session?: TrainingSessionMetadata;
  scannedDocument?: ScannedDocumentInfo | null;
}

const ATTENDANCE_TONE: Record<AttendanceStatus, "success" | "warning" | "danger" | "neutral"> = {
  PRESENT: "success",
  ABSENT: "danger",
  INJURED: "warning",
  EXCUSED: "neutral"
};

const POSITION_LABELS: Record<string, { ar: string; fr: string }> = {
  GOALKEEPER: { ar: "حارس مرمى", fr: "Gardien" },
  DEFENDER: { ar: "مدافع", fr: "Défenseur" },
  MIDFIELDER: { ar: "وسط ميدان", fr: "Milieu" },
  FORWARD: { ar: "مهاجم", fr: "Attaquant" }
};

export function TrainingAttendanceSheet({
  sessionId,
  players,
  canManage,
  locale,
  printOnly = false,
  session,
  scannedDocument
}: TrainingAttendanceSheetProps) {
  const t = useTranslations("training");
  const tCommon = useTranslations("common");
  const isAr = locale === "ar";

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [currentScannedDoc, setCurrentScannedDoc] = useState<ScannedDocumentInfo | null>(scannedDocument || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [records, setRecords] = useState<Record<string, AttendanceStatus>>(() => {
    const initial: Record<string, AttendanceStatus> = {};
    for (const p of players) {
      initial[p.id] = p.currentStatus || "PRESENT";
    }
    return initial;
  });

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSelectAll = (status: AttendanceStatus) => {
    setRecords((prev) => {
      const next = { ...prev };
      for (const p of players) {
        next[p.id] = status;
      }
      return next;
    });
  };

  const handlePlayerStatusChange = (playerId: string, status: AttendanceStatus) => {
    setRecords((prev) => ({
      ...prev,
      [playerId]: status
    }));
  };

  const handleSave = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const payload = Object.entries(records).map(([playerId, status]) => ({
          playerId,
          status
        }));
        const res = await saveBulkAttendanceAction(sessionId, payload);
        if (res.success) {
          setFeedback({
            type: "success",
            text: t("attendance.savedSuccess")
          });
        }
      } catch (err: any) {
        setFeedback({
          type: "error",
          text: err.message || "Failed to save attendance"
        });
      }
    });
  };

  const handleUploadScannedDoc = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("scannedSheetFile", file);

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await uploadTrainingScannedSheetAction(sessionId, formData);
        if (res.success) {
          setCurrentScannedDoc({
            id: res.documentId,
            name: file.name,
            originalName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            createdAt: new Date().toISOString()
          });
          form.reset();
          setFeedback({
            type: "success",
            text: isAr ? "تم رفع وتوثيق ورقة الحضور الموقعة بنجاح" : "Document émargé téléversé avec succès"
          });
        }
      } catch (err: any) {
        setFeedback({
          type: "error",
          text: err.message || "Failed to upload scanned sheet"
        });
      }
    });
  };

  const handleDeleteScannedDoc = () => {
    if (!currentScannedDoc) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        await deleteTrainingScannedSheetAction(sessionId, currentScannedDoc.id);
        setCurrentScannedDoc(null);
        setFeedback({
          type: "success",
          text: isAr ? "تم حذف الوثيقة بنجاح" : "Document supprimé avec succès"
        });
      } catch (err: any) {
        setFeedback({
          type: "error",
          text: err.message || "Failed to delete scanned sheet"
        });
      }
    });
  };

  const counts = {
    present: Object.values(records).filter((s) => s === "PRESENT").length,
    absent: Object.values(records).filter((s) => s === "ABSENT").length,
    injured: Object.values(records).filter((s) => s === "INJURED").length,
    excused: Object.values(records).filter((s) => s === "EXCUSED").length
  };

  return (
    <div className="space-y-4">
      {printOnly ? (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <Printer className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">{isAr ? "قائمة حضور الحصة" : "Feuille de présence"}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{isAr ? "اطبع قائمة اللاعبين للحصة التدريبية." : "Imprimez la liste des joueurs pour la séance."}</p>
            </div>
          </div>
          {session && canManage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPrintModalOpen(true)}
              className="shrink-0 border-emerald-600/50 font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span>{isAr ? "طباعة قائمة الحضور" : "Imprimer la feuille"}</span>
            </Button>
          )}
        </div>
      ) : (
      <>
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Scanned Document Archiving Box (توثيق ورفع الورقة بعد التدريب) */}
      <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-club-primary" />
            <span className="text-xs sm:text-sm font-bold text-foreground">
              {isAr ? "توثيق ورقة الحضور الموقّعة بالمسح الضوئي أو الصورة" : "Joindre la feuille de présence signée (scan ou photo)"}
            </span>
          </div>
          {session && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPrintModalOpen(true)}
              className="h-7 text-xs border-emerald-600/50 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 font-bold flex items-center gap-1.5"
            >
              <Printer className="h-3 w-3 text-emerald-600" />
              <span>{isAr ? "طباعة" : "Imprimer"}</span>
            </Button>
          )}
        </div>

        {currentScannedDoc ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/20 dark:border-emerald-800 text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-950 dark:text-emerald-100 text-xs sm:text-sm">
                  {isAr ? "تم توثيق ورفع ورقة الحضور الرسمية الموقعة" : "Document émargé officiel archivé"}
                </p>
                <p className="text-emerald-700 dark:text-emerald-300 text-[11px] mt-0.5">
                  {currentScannedDoc.originalName} ({Math.round(currentScannedDoc.sizeBytes / 1024)} KB)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`/api/documents/${currentScannedDoc.id}/download`}
                download
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-300 transition-colors shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isAr ? "معاينة وتحميل" : "Télécharger"}</span>
              </a>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteScannedDoc}
                  disabled={isPending}
                  className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                  title={isAr ? "حذف الوثيقة" : "Supprimer"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          canManage && (
            <form onSubmit={handleUploadScannedDoc} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                name="scannedSheetFile"
                accept=".pdf,.png,.jpg,.jpeg"
                required
                className="flex-1 text-xs text-muted-foreground file:me-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer border border-border rounded-lg bg-background p-1"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{isPending ? tCommon("loading") : (isAr ? "رفع وتوثيق الوثيقة" : "Téléverser")}</span>
              </Button>
            </form>
          )
        )}
      </div>

      {/* Roster Header & Attendance Stats */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("attendance.title")}</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1 font-medium text-emerald-600">
              <Check className="h-3 w-3" />
              {t("attendance.PRESENT")}: {counts.present}
            </span>
            <span className="flex items-center gap-1 font-medium text-red-600">
              <X className="h-3 w-3" />
              {t("attendance.ABSENT")}: {counts.absent}
            </span>
            <span className="flex items-center gap-1 font-medium text-amber-600">
              <ShieldAlert className="h-3 w-3" />
              {t("attendance.INJURED")}: {counts.injured}
            </span>
            <span className="flex items-center gap-1 font-medium text-zinc-600">
              <Clock className="h-3 w-3" />
              {t("attendance.EXCUSED")}: {counts.excused}
            </span>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSelectAll("PRESENT")}
              disabled={isPending}
              className="h-8 text-xs"
            >
              {t("attendance.selectAllPresent")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSelectAll("ABSENT")}
              disabled={isPending}
              className="h-8 text-xs"
            >
              {t("attendance.selectAllAbsent")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              className="h-8 text-xs bg-club-primary hover:bg-club-primary-hover text-white font-medium flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isPending ? tCommon("loading") : t("attendance.save")}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Players List */}
      <ul className="divide-y divide-border">
        {players.map((p) => {
          const current = records[p.id] ?? "PRESENT";
          return (
            <li key={p.id} className="flex min-w-0 items-center justify-between gap-3 py-2.5 text-sm">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {p.shirtNumber !== null && (
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold text-muted-foreground">
                    {p.shirtNumber}
                  </span>
                )}
                <div className="flex min-w-0 flex-1 items-center gap-x-2">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={getPlayerDisplayName(p, locale)}>
                    {getPlayerDisplayName(p, locale)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {POSITION_LABELS[p.position]?.[isAr ? "ar" : "fr"] || p.position}
                  </span>
                </div>
              </div>

              {canManage ? (
                <div className="flex items-center gap-1 sm:gap-2">
                  {(["PRESENT", "ABSENT", "INJURED", "EXCUSED"] as const).map((status) => {
                    const active = current === status;
                    const toneClasses = {
                      PRESENT: active
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-background text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300",
                      ABSENT: active
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-background text-muted-foreground hover:bg-red-50 hover:text-red-700 hover:border-red-300",
                      INJURED: active
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-background text-muted-foreground hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300",
                      EXCUSED: active
                        ? "bg-zinc-600 text-white border-zinc-600"
                        : "bg-background text-muted-foreground hover:bg-zinc-100 hover:text-zinc-800 hover:border-zinc-300"
                    };

                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handlePlayerStatusChange(p.id, status)}
                        className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${toneClasses[status]}`}
                      >
                        {t(`attendance.${status}` as any)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Badge tone={ATTENDANCE_TONE[current]}>
                  {t(`attendance.${current}` as any)}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
      </>
      )}

      {/* Official Printable Coach Attendance Sheet Modal */}
      {session && (
        <OfficialAttendanceSheetModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          session={session}
          players={players}
          locale={locale}
        />
      )}
    </div>
  );
}
