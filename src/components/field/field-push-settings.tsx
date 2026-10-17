"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, LoaderCircle } from "lucide-react";

type PushConfig = { enabled: boolean; publicKey: string | null; endpointHashes: string[] };
type Props = { locale: string };

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = window.atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function endpointHash(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function FieldPushSettings({ locale }: Props) {
  const isAr = locale === "ar";
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/field/push/subscription", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as PushConfig : { enabled: false, publicKey: null, endpointHashes: [] })
      .then(async (value) => {
        if (!active) return;
        setConfig(value);
        if (value.enabled && "serviceWorker" in navigator && "PushManager" in window) {
          const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
          const existing = await registration.pushManager.getSubscription();
          if (active && existing) setSubscribed(value.endpointHashes.includes(await endpointHash(existing.endpoint)));
        }
      })
      .catch(() => { if (active) setConfig({ enabled: false, publicKey: null, endpointHashes: [] }); });
    return () => { active = false; };
  }, []);

  async function togglePush() {
    if (!config?.publicKey || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && subscribed) {
        const removed = await fetch("/api/field/push/subscription", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        if (!removed.ok) throw new Error("unlink_failed");
        setSubscribed(false);
        return;
      }

      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") throw new Error("permission_denied");
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(config.publicKey)
      });
      const response = await fetch("/api/field/push/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: isAr ? "ar" : "fr", subscription: subscription.toJSON() })
      });
      if (!response.ok) throw new Error(response.status === 503 ? "push_unavailable" : "subscribe_failed");
      setSubscribed(true);
    } catch (error) {
      const code = error instanceof Error ? error.message : "subscribe_failed";
      setMessage(code === "permission_denied"
        ? (isAr ? "لم يتم منح إذن الإشعارات لهذا التطبيق." : "L’autorisation des notifications a été refusée.")
        : (isAr ? "تعذر تفعيل الإشعارات. تحقق من إعدادات الخدمة وحاول مجددًا." : "Impossible d’activer les notifications. Vérifiez la configuration et réessayez."));
    } finally {
      setBusy(false);
    }
  }

  const disabled = !config?.enabled || busy;
  return <div className="flex min-w-0 items-center gap-2">
    <button type="button" onClick={() => void togglePush()} disabled={disabled} aria-pressed={subscribed}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[10px] font-bold text-foreground transition hover:border-club-primary hover:text-club-primary disabled:cursor-not-allowed disabled:opacity-50 sm:px-3">
      {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : subscribed ? <BellRing className="h-3.5 w-3.5 text-emerald-500" /> : <Bell className="h-3.5 w-3.5" />}
      <span>{config && !config.enabled ? (isAr ? "الإشعارات غير مهيأة" : "Notifications indisponibles") : subscribed ? (isAr ? "الإشعارات مفعلة" : "Notifications activées") : (isAr ? "تفعيل إشعارات الاجتماعات" : "Activer les alertes réunion")}</span>
    </button>
    {message && <span role="status" className="max-w-36 text-[9px] text-destructive">{message}</span>}
  </div>;
}
