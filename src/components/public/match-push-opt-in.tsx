"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Bell, LoaderCircle, Smartphone, X } from "lucide-react";
import { toast } from "sonner";

type Props = { locale: string };
type PushConfig = { enabled: boolean; publicKey: string | null };
const PUSH_PROMPT_DISMISSED_KEY = "esh-match-push-prompt-dismissed-session-v2";
const LEGACY_PUSH_PROMPT_DISMISSED_KEY = "esh-match-push-prompt-dismissed-v1";

function isNotificationPromptPage(pathname: string | null): boolean {
  const path = (pathname ?? "/").replace(/^\/(?:ar|fr)(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  return path === "/" || path === "/matches" || path.startsWith("/matches/");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getDeviceToken(): string {
  const key = "esh-push-device-token";
  let token = window.localStorage.getItem(key);
  if (!token) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    token = base64Url(bytes);
    window.localStorage.setItem(key, token);
  }
  return token;
}

function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function MatchPushOptIn({ locale }: Props) {
  const isAr = locale === "ar";
  const pathname = usePathname();
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
    // Older versions stored dismissal permanently. Clear that value so the
    // prompt follows the current visit-only behavior instead.
    window.localStorage.removeItem(LEGACY_PUSH_PROMPT_DISMISSED_KEY);
    const referrer = document.referrer;
    if (referrer) {
      try {
        if (new URL(referrer).origin !== window.location.origin) {
          window.sessionStorage.removeItem(PUSH_PROMPT_DISMISSED_KEY);
        }
      } catch {
        // Ignore malformed referrers; they should not block the public page.
      }
    }
    setDismissed(window.sessionStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === "1");
    setPermissionGranted("Notification" in window && Notification.permission === "granted");
    setPermissionDenied("Notification" in window && Notification.permission === "denied");
    let cancelled = false;
    const onExternalNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || !link.href || (link.target && link.target !== "_self")) return;
      try {
        if (new URL(link.href, window.location.href).origin !== window.location.origin) {
          window.sessionStorage.removeItem(PUSH_PROMPT_DISMISSED_KEY);
        }
      } catch {
        // Ignore malformed links.
      }
    };
    const refreshPermissionState = () => {
      setDismissed(window.sessionStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === "1");
      const permission = "Notification" in window ? Notification.permission : "default";
      setPermissionGranted(permission === "granted");
      setPermissionDenied(permission === "denied");
    };
    document.addEventListener("click", onExternalNavigation, true);
    window.addEventListener("pageshow", refreshPermissionState);
    window.addEventListener("focus", refreshPermissionState);
    void Promise.all([
      fetch("/api/push/config", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<PushConfig> : { enabled: false, publicKey: null }).catch(() => ({ enabled: false, publicKey: null })),
      Promise.resolve().then(async () => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;
        if (Notification.permission !== "granted") return false;
        // Permission is the user's durable consent. Repair a missing local subscription
        // quietly so returning visitors never see the opt-in prompt again.
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) return true;

        const pushConfig = await fetch("/api/push/config", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<PushConfig> : null).catch(() => null);
        if (!pushConfig?.enabled || !pushConfig.publicKey) return false;
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(pushConfig.publicKey) });
        const response = await fetch("/api/push/subscription", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deviceToken: getDeviceToken(), locale: window.location.pathname.startsWith("/fr") ? "fr" : "ar", subscription: subscription.toJSON() })
        });
        if (!response.ok) {
          await subscription.unsubscribe().catch(() => undefined);
          return false;
        }
        return true;
      }).catch(() => false)
    ]).then(([nextConfig, hasSubscription]) => {
      if (!cancelled) {
        setConfig(nextConfig);
        setEnabled(hasSubscription);
        setSubscriptionChecked(true);
      }
    });
    return () => {
      cancelled = true;
      document.removeEventListener("click", onExternalNavigation, true);
      window.removeEventListener("pageshow", refreshPermissionState);
      window.removeEventListener("focus", refreshPermissionState);
    };
  }, []);

  const showPushPrompt = isNotificationPromptPage(pathname) && !dismissed && !permissionDenied && !permissionGranted && !enabled && subscriptionChecked;
  const isIOS = isAppleMobile();

  async function enableNotifications() {
    setMessage(null);
    if (!config?.enabled || !config.publicKey) {
      setMessage(isAr ? "إشعارات المباريات غير مهيأة حاليًا." : "Les notifications de match ne sont pas encore configurées.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      if (isAppleMobile() && !isStandalone()) {
        setMessage(isAr
          ? "على iPhone/iPad: أضف الموقع إلى الشاشة الرئيسية أولًا، ثم افتحه من الأيقونة وفعّل التنبيهات."
          : "Sur iPhone/iPad : ajoutez d’abord le site à l’écran d’accueil, ouvrez-le depuis son icône, puis activez les alertes.");
      } else {
        setMessage(isAr ? "المتصفح لا يدعم إشعارات الويب على هذا الجهاز." : "Ce navigateur ne prend pas en charge les notifications Web sur cet appareil.");
      }
      return;
    }
    if (isAppleMobile() && !isStandalone()) {
      setMessage(isAr
        ? "على iPhone/iPad، أضف الموقع إلى الشاشة الرئيسية وافتحه منها قبل تفعيل التنبيهات."
        : "Sur iPhone/iPad, ajoutez le site à l’écran d’accueil et ouvrez-le depuis celle-ci avant d’activer les alertes.");
      return;
    }

    setBusy(true);
    try {
      // Must be called immediately inside the click gesture to satisfy browser permission policies.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") setPermissionDenied(true);
        setMessage(permission === "denied"
          ? (isAr ? "الإشعارات محظورة من إعدادات المتصفح. غيّر الإذن ثم أعد المحاولة." : "Les notifications sont bloquées dans les réglages du navigateur.")
          : (isAr ? "لم يتم تفعيل الإشعارات." : "Les notifications n’ont pas été activées."));
        return;
      }

      // The browser's durable permission is the user's opt-in. Hide the prompt
      // immediately even if server-side subscription registration needs a retry.
      setPermissionGranted(true);
      setDismissed(true);
      window.sessionStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(config.publicKey)
      });
      const response = await fetch("/api/push/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceToken: getDeviceToken(), locale: isAr ? "ar" : "fr", subscription: subscription.toJSON() })
      });
      if (!response.ok) throw new Error("subscription-save-failed");
      setEnabled(true);
    } catch {
      toast.error(isAr
        ? "الإذن مفعل، لكن تعذر ربط هذا الجهاز بالإشعارات. ستتم إعادة المحاولة عند فتح الموقع."
        : "L’autorisation est accordée, mais l’appareil n’a pas pu être relié. Une nouvelle tentative aura lieu à la prochaine visite.");
    } finally {
      setBusy(false);
    }
  }

  const unavailable = config !== null && !config.enabled;
  if (!portalReady || !showPushPrompt) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-[1000] flex w-full flex-col items-center gap-2 px-3 sm:top-20 sm:px-6"
      style={{ position: "fixed", insetInline: 0 }}
    >
    {showPushPrompt && <section className="pointer-events-auto mx-auto w-full max-w-7xl" aria-label={isAr ? "إشعارات المباريات" : "Notifications des matchs"}>
      <div className="flex flex-col gap-3 rounded-xl border border-club-primary/25 bg-card/95 px-3 py-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-club-primary/10 text-club-primary">
            <Bell className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground">
              {isAr ? "تابع مباريات النادي لحظة بلحظة" : "Suivez les matchs du club en direct"}
            </h2>
            <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
              {message ?? (isAr
                ? "يصلك إشعار عند بداية المباراة، تسجيل هدف، ونهايتها — حتى عندما تغلق الموقع."
                : "Recevez une alerte au coup d’envoi, à chaque but et au coup de sifflet final, même site fermé.")}
            </p>
            {isIOS && !isStandalone() && !enabled && (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-club-primary">
                <Smartphone className="h-3 w-3" />
                {isAr ? "على iPhone: أضف الموقع إلى الشاشة الرئيسية أولًا." : "Sur iPhone : ajoutez le site à l’écran d’accueil."}
              </p>
            )}
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:ps-3">
            <button type="button" onClick={enableNotifications} disabled={busy || config === null || unavailable} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-club-primary px-4 text-xs font-bold text-white shadow-xs transition-colors hover:bg-club-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              {unavailable
                ? (isAr ? "غير مهيأة" : "Indisponible")
                : (isAr ? "تفعيل التنبيهات" : "Activer les alertes")}
            </button>
          <button type="button" onClick={() => { setDismissed(true); window.sessionStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1"); }} aria-label={isAr ? "إخفاء" : "Masquer"} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
      </div>
    </section>}
    </div>,
    document.body
  );
}
