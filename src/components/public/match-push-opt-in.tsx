"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Download, LoaderCircle, Smartphone, X } from "lucide-react";

type Props = { locale: string };
type PushConfig = { enabled: boolean; publicKey: string | null };
const PUSH_PROMPT_DISMISSED_KEY = "esh-match-push-prompt-dismissed-v1";

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

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function MatchPushOptIn({ locale }: Props) {
  const isAr = locale === "ar";
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
    setDismissed(window.localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === "1");
    setPermissionDenied("Notification" in window && Notification.permission === "denied");
    let cancelled = false;
    setInstalled(isStandalone());
    setInstallDismissed(window.localStorage.getItem("esh-install-prompt-dismissed") === "1");
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
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
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const showPushPrompt = !dismissed && !permissionDenied && message !== "dismissed" && !enabled && subscriptionChecked;
  const isIOS = isAppleMobile();
  const showInstallPrompt = !installed && !installDismissed && (Boolean(installPrompt) || isIOS);

  async function installApp() {
    if (!installPrompt) {
      setInstallMessage(isAr
        ? "اضغط زر المشاركة في المتصفح، ثم اختر «إضافة إلى الشاشة الرئيسية»."
        : "Touchez Partager dans le navigateur, puis « Sur l’écran d’accueil ». ");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

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
      setDismissed(true);
      window.localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
    } catch {
      setMessage(isAr ? "تعذر تفعيل التنبيهات الآن. تحقق من الاتصال وحاول مجددًا." : "Impossible d’activer les alertes. Vérifiez la connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const unavailable = config !== null && !config.enabled;
  if (!portalReady || (!showInstallPrompt && !showPushPrompt)) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-[1000] flex w-full flex-col items-center gap-2 px-3 sm:top-20 sm:px-6"
      style={{ position: "fixed", insetInline: 0 }}
    >
    {showInstallPrompt && <section className="pointer-events-auto mx-auto flex w-full max-w-7xl flex-col gap-3 rounded-xl border border-border bg-card/95 px-3 py-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-4" aria-label={isAr ? "تثبيت الموقع كتطبيق" : "Installer le site"}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-club-primary/10 text-club-primary"><Smartphone className="h-4 w-4" /></span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground">{isAr ? "ثبّت موقع النادي على هاتفك" : "Installez le site du club sur votre téléphone"}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{installMessage ?? (isAr ? "افتح الموقع كتطبيق من الشاشة الرئيسية." : "Ouvrez le site comme une application depuis l’écran d’accueil.")}</p>
        </div>
      </div>
      <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
        <button type="button" onClick={() => void installApp()} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-club-primary px-4 text-xs font-bold text-white shadow-xs transition-colors hover:bg-club-primary/90 sm:flex-none"><Download className="h-4 w-4" />{isAr ? "تثبيت الموقع" : "Installer"}</button>
        <button type="button" onClick={() => { setInstallDismissed(true); window.localStorage.setItem("esh-install-prompt-dismissed", "1"); }} aria-label={isAr ? "إخفاء" : "Masquer"} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
    </section>}
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
          <button type="button" onClick={() => { setDismissed(true); setMessage("dismissed"); window.localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1"); }} aria-label={isAr ? "إخفاء" : "Masquer"} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
      </div>
    </section>}
    </div>,
    document.body
  );
}
