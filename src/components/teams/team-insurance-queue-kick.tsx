"use client";

import { useEffect } from "react";

export function TeamInsuranceQueueKick({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    void fetch("/api/teams/insurance/process", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
  }, [enabled]);

  return null;
}
