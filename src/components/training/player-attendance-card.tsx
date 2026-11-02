"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  MapPin,
  UserCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { localizedClubName } from "@/lib/public/locale-text";
import { getPlayerDisplayName } from "@/lib/utils";

export interface PlayerAttendanceRecord {
  trainingId: string;
  status: "PRESENT" | "ABSENT" | "INJURED" | "EXCUSED";
  training: {
    id: string;
    date: Date | string;
    startTime: Date | string;
    endTime: Date | string;
    location?: string | null;
    coach?: {
      id?: string;
      firstName?: string;
      lastName?: string;
    } | null;
    team?: {
      id?: string;
      name?: string;
      category?: string;
    } | null;
  };
}

interface PlayerAttendanceCardProps {
  attendances: PlayerAttendanceRecord[];
  locale?: string;
}

export function PlayerAttendanceCard({ attendances = [], locale = "ar" }: PlayerAttendanceCardProps) {
  const isAr = locale === "ar";
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const totalSessions = attendances.length;
  const presentCount = attendances.filter((a) => a.status === "PRESENT").length;
  const absentCount = attendances.filter((a) => a.status === "ABSENT").length;
  const injuredCount = attendances.filter((a) => a.status === "INJURED").length;
  const excusedCount = attendances.filter((a) => a.status === "EXCUSED").length;

  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

  const totalPages = Math.ceil(totalSessions / pageSize) || 1;
  const paginatedAttendances = attendances.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getStatusBadge = (status: "PRESENT" | "ABSENT" | "INJURED" | "EXCUSED") => {
    switch (status) {
      case "PRESENT":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{isAr ? "حاضر" : "Présent"}</span>
          </span>
        );
      case "ABSENT":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-xs font-bold text-red-600 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5" />
            <span>{isAr ? "غائب" : "Absent"}</span>
          </span>
        );
      case "INJURED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{isAr ? "مصاب" : "Blessé"}</span>
          </span>
        );
      case "EXCUSED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400">
            <Clock className="h-3.5 w-3.5" />
            <span>{isAr ? "مبرر" : "Excusé"}</span>
          </span>
        );
    }
  };

  const formatSessionDate = (d: Date | string) => {
    const date = new Date(d);
    return date.toLocaleDateString(isAr ? "ar-DZ" : "fr-FR", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 sm:p-5 bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isAr ? "سجل حضور وغياب التدريبات" : "Suivi des Présences aux Entraînements"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "السجل الميداني لالتزام اللاعب بالحصص التدريبية"
                  : "Historique officiel des présences du joueur sur le terrain"}
              </p>
            </div>
          </div>

          {/* Quick Rate Pill */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">
              {isAr ? "نسبة الحضور:" : "Taux :"}
            </span>
            <span
              className={`font-mono text-sm font-black px-2.5 py-0.5 rounded-full border ${
                attendanceRate >= 80
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : attendanceRate >= 60
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                  : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
              }`}
            >
              {attendanceRate}%
            </span>
          </div>
        </div>

        {/* Attendance Progress & Breakdown Stats */}
        <div className="mt-4 space-y-2">
          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-500 ${
                attendanceRate >= 80 ? "bg-emerald-500" : attendanceRate >= 60 ? "bg-amber-500" : "bg-red-500"
              }`}
              style={{ width: `${attendanceRate}%` }}
            />
          </div>

          {/* Stat Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center text-xs">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2">
              <span className="block font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                {presentCount}
              </span>
              <span className="text-[11px] text-muted-foreground font-semibold">
                {isAr ? "حاضر" : "Présent"}
              </span>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-2">
              <span className="block font-mono text-base font-bold text-red-600 dark:text-red-400">
                {absentCount}
              </span>
              <span className="text-[11px] text-muted-foreground font-semibold">
                {isAr ? "غائب" : "Absent"}
              </span>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2">
              <span className="block font-mono text-base font-bold text-amber-600 dark:text-amber-400">
                {injuredCount}
              </span>
              <span className="text-[11px] text-muted-foreground font-semibold">
                {isAr ? "مصاب" : "Blessé"}
              </span>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-2">
              <span className="block font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                {excusedCount}
              </span>
              <span className="text-[11px] text-muted-foreground font-semibold">
                {isAr ? "مبرر" : "Excusé"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="divide-y divide-border">
        {totalSessions === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <UserCheck className="mx-auto h-10 w-10 opacity-30 mb-2" />
            <p className="text-sm font-semibold">
              {isAr ? "لا توجد حصص تدريبية مسجلة بعد لهذا اللاعب" : "Aucune séance enregistrée pour ce joueur"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isAr
                ? "يتم تدوين الحضور والغياب تلقائياً عند حفظ ورقة حضور التدريب"
                : "Les présences sont enregistrées lors de la validation de la feuille de séance"}
            </p>
          </div>
        ) : (
          paginatedAttendances.map((record) => (
            <div
              key={record.trainingId}
              className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="space-y-1 min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-foreground">
                    {formatSessionDate(record.training.date)}
                  </span>
                  {record.training.team && (
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
                      {localizedClubName(record.training.team.name, locale, isAr ? "الفريق" : "Club")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {record.training.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground/80" />
                      <span>{record.training.location}</span>
                    </span>
                  )}
                  {record.training.coach && (
                    <span>
                      {isAr ? "المدرب: " : "Coach : "}
                      {getPlayerDisplayName(record.training.coach, locale)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {getStatusBadge(record.status)}
                <Link
                  href={`/${locale}/dashboard/training/${record.training.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold underline underline-offset-2"
                >
                  {isAr ? "الحصة" : "Séance"}
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
          <span>
            {isAr
              ? `عرض ${Math.min(totalSessions, (currentPage - 1) * pageSize + 1)} إلى ${Math.min(
                  totalSessions,
                  currentPage * pageSize
                )} من أصل ${totalSessions} حصة`
              : `Affichage ${Math.min(totalSessions, (currentPage - 1) * pageSize + 1)}-${Math.min(
                  totalSessions,
                  currentPage * pageSize
                )} sur ${totalSessions}`}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2 text-xs"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              <span>{isAr ? "السابق" : "Précédent"}</span>
            </Button>
            <span className="font-mono px-2 font-bold text-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 px-2 text-xs"
            >
              <span>{isAr ? "التالي" : "Suivant"}</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
