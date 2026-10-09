"use client";

import { useEffect, useState, type ReactNode } from "react";

const PRE_MATCH_WINDOW_MS = 30 * 60 * 1000;

function canUploadSheet(status: string, matchDate: string | Date, now: number) {
  if (status === "LIVE") return true;
  if (status !== "SCHEDULED") return false;
  const remaining = new Date(matchDate).getTime() - now;
  return remaining > 0 && remaining <= PRE_MATCH_WINDOW_MS;
}

export function PreMatchSheetUploadGate({
  status,
  matchDate,
  locale,
  children
}: {
  status: string;
  matchDate: string | Date;
  locale: string;
  children: ReactNode;
}) {
  const isAr = locale === "ar";
  const [available, setAvailable] = useState(status === "LIVE");

  useEffect(() => {
    const refresh = () => setAvailable(canUploadSheet(status, matchDate, Date.now()));
    refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(timer);
  }, [status, matchDate]);

  if (available) return children;

  return (
    <p className="rounded-lg border border-dashed border-border bg-background/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground" role="status">
      {isAr
        ? "يتاح رفع ورقة المباراة خلال آخر 30 دقيقة قبل البداية، أو أثناء المباراة الجارية."
        : "La feuille de match peut être déposée dans les 30 minutes avant le coup d’envoi ou pendant le match."}
    </p>
  );
}
