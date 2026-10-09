"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { syncMailboxForNotifications } from "@/app/[locale]/(dashboard)/dashboard/mail/notification-actions";

const MAIL_NOTIFICATION_STORAGE_KEY = "esh-mail-notifications-seen-v1";

export function DashboardMailNotifier({ locale, enabled }: { locale: string; enabled: boolean }) {
  const router = useRouter();
  const running = useRef(false);
  const notifiedIds = useRef(new Set<string>());
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    try {
      const stored = JSON.parse(localStorage.getItem(MAIL_NOTIFICATION_STORAGE_KEY) || "{}") as Record<string, number>;
      const cutoff = Date.now() - 30 * 60 * 1000;
      Object.entries(stored).forEach(([id, timestamp]) => {
        if (timestamp >= cutoff) notifiedIds.current.add(id);
      });
      localStorage.setItem(
        MAIL_NOTIFICATION_STORAGE_KEY,
        JSON.stringify(Object.fromEntries([...notifiedIds.current].map((id) => [id, stored[id] ?? Date.now()])))
      );
    } catch {
      // Storage can be unavailable in private browsing; the in-tab guard still works.
    }

    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("esh-mail-notifications");
      channel.current.onmessage = (event) => {
        if (event.data?.type === "seen" && typeof event.data.id === "string") {
          notifiedIds.current.add(event.data.id);
        }
      };
    }

    const claimNotification = (id: string) => {
      if (notifiedIds.current.has(id)) return false;
      notifiedIds.current.add(id);
      try {
        const stored = JSON.parse(localStorage.getItem(MAIL_NOTIFICATION_STORAGE_KEY) || "{}") as Record<string, number>;
        stored[id] = Date.now();
        localStorage.setItem(MAIL_NOTIFICATION_STORAGE_KEY, JSON.stringify(stored));
      } catch {
        // Continue with the in-tab guard when storage is unavailable.
      }
      channel.current?.postMessage({ type: "seen", id });
      return true;
    };

    const check = async () => {
      if (!active || running.current || document.visibilityState !== "visible") return;
      running.current = true;
      try {
        const result = await syncMailboxForNotifications();
        const freshNotification = result.recentNotificationIds.reduce(
          (found, id) => claimNotification(id) || found,
          false
        );
        if (active && freshNotification) {
          toast.success(locale === "ar" ? "وصل بريد إلكتروني جديد" : "Un nouvel e-mail est arrivé");
          router.refresh();
        } else if (active && result.newMessagesCount > 0) {
          // Older mail is persisted in the notification center without a toast.
          router.refresh();
        }
      } finally {
        running.current = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      channel.current?.close();
      channel.current = null;
    };
  }, [enabled, locale, router]);

  return null;
}
