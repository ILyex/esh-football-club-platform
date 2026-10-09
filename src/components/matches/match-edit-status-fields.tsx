"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { FormSelect } from "@/components/ui/form-select";
import { updateMatchStatusAction } from "@/app/[locale]/(dashboard)/dashboard/matches/actions";

interface MatchEditStatusFieldsProps {
  matchId: string;
  locale: string;
  initialStatus: string;
  initialMatchDate: string | Date;
  canUpdate: boolean;
  statusLabel: string;
  dateLabel: string;
  statuses: Array<{ value: string; label: string }>;
}

function localDateTimeValue() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function normalizeDateTime(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 16);
  return value.includes("T") ? value.slice(0, 16) : value;
}

export function MatchEditStatusFields({
  matchId,
  locale,
  initialStatus,
  initialMatchDate,
  canUpdate,
  statusLabel,
  dateLabel,
  statuses
}: MatchEditStatusFieldsProps) {
  const normalizedInitialStatus = initialStatus === "CANCELLED" ? "POSTPONED" : initialStatus;
  const [status, setStatus] = useState(normalizedInitialStatus);
  const [matchDate, setMatchDate] = useState(normalizeDateTime(initialMatchDate));
  const [savingStatus, setSavingStatus] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();
  const remainingMs = new Date(matchDate).getTime() - now;
  const isStartingSoon = status === "SCHEDULED" && remainingMs > 0 && remainingMs <= 30 * 60 * 1000;
  const selectedStatus = isStartingSoon ? "STARTING_SOON" : status;
  const statusColor = isStartingSoon
    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:border-amber-500/60 focus-visible:border-amber-500 focus-visible:ring-amber-500/20"
    : status === "LIVE"
    ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 hover:border-red-500/60 focus-visible:border-red-500 focus-visible:ring-red-500/20"
    : status === "FINISHED"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:border-emerald-500/60 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
      : status === "POSTPONED"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:border-amber-500/60 focus-visible:border-amber-500 focus-visible:ring-amber-500/20"
        : "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400 hover:border-sky-500/60 focus-visible:border-sky-500 focus-visible:ring-sky-500/20";

  useEffect(() => {
    setStatus(initialStatus === "CANCELLED" ? "POSTPONED" : initialStatus);
    setMatchDate(normalizeDateTime(initialMatchDate));
  }, [initialStatus, initialMatchDate]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleStatusChange(nextStatus: string) {
    const persistedStatus = nextStatus === "STARTING_SOON" ? "SCHEDULED" : nextStatus;
    if (persistedStatus === status || savingStatus) return;
    const previousStatus = status;
    setStatus(persistedStatus);
    if (persistedStatus === "LIVE") setMatchDate(localDateTimeValue());
    setSavingStatus(true);
    try {
      await updateMatchStatusAction(matchId, persistedStatus);
      toast.success(locale === "ar" ? "تم تحديث الحالة وفتح الخانات المرتبطة بها" : "Statut mis à jour et sections associées actualisées");
      router.refresh();
    } catch (error) {
      console.error("Match status update failed:", error);
      setStatus(previousStatus);
      const shootoutPending = error instanceof Error && error.message === "shootoutWinnerRequired";
      toast.error(shootoutPending
        ? (locale === "ar" ? "أكمل ركلات الترجيح لحسم الفائز قبل إنهاء المباراة" : "Terminez la séance de tirs au but avant de clôturer le match")
        : (locale === "ar" ? "تعذر تحديث حالة المباراة" : "Impossible de mettre à jour le statut du match"));
      router.refresh();
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:col-span-2">
      <div className="min-w-0 rounded-xl border border-border/70 bg-background/30 p-3">
        <label className="mb-2 block text-xs font-bold text-muted-foreground">{statusLabel}</label>
        <FormSelect
          name="status"
          value={selectedStatus}
          disabled={!canUpdate || savingStatus}
          locale={locale}
          ariaLabel={statusLabel}
          triggerClassName={statusColor}
          onValueChange={handleStatusChange}
          options={statuses.map((option) => option.value === "STARTING_SOON"
            ? { ...option, disabled: !isStartingSoon }
            : option)}
        />
      </div>
      <div className="min-w-0 rounded-xl border border-border/70 bg-background/30 p-3">
        <DateTimeInput
          label={dateLabel}
          name="matchDate"
          value={matchDate}
          required
          disabled={!canUpdate}
          locale={locale}
          onChange={(_, iso) => {
            setMatchDate(iso ?? "");
          }}
        />
      </div>
    </div>
  );
}
