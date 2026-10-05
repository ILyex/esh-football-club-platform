"use client";

import { useEffect } from "react";
import { updatePresenceAction } from "@/app/[locale]/(dashboard)/dashboard/presence-actions";

export function DashboardPresenceHeartbeat() {
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") {
        void updatePresenceAction().catch(() => {
          // Presence is informational; a failed heartbeat must not interrupt dashboard use.
        });
      }
    };

    update();
    const timer = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return null;
}
