"use client";

import { useEffect, useRef, useState } from "react";
import type { CapErrorEvent, CapResetEvent, CapSolveEvent, CapWidget } from "cap-widget";

type CapLoginWidgetProps = {
  endpoint: string;
  locale: string;
  onReady: (ready: boolean) => void;
  onToken: (token: string) => void;
};

/** Keeps Cap's attribution link while replacing its visible wordmark with a club-colored shield. */
function applyCapCreditIcon(widget: CapWidget) {
  const shadowRoot = widget.shadowRoot;
  const credits = shadowRoot?.querySelector<HTMLAnchorElement>(".credits");
  if (!shadowRoot || !credits || credits.querySelector("svg")) return;

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "16");
  icon.setAttribute("height", "16");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.8");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");

  const shield = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shield.setAttribute("d", "M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z");
  icon.append(shield);

  // Keep the service attribution available to assistive technology and to the
  // widget's own integrity check, which restores the label if it is removed.
  const label = document.createElement("span");
  label.className = "cap-credit-label";
  label.textContent = "Cap";
  credits.replaceChildren(icon, label);

  if (!shadowRoot.querySelector("style[data-esh-cap-credit]")) {
    const style = document.createElement("style");
    style.dataset.eshCapCredit = "true";
    style.textContent = `
      .captcha .credits { color: var(--club-primary, #dc1233) !important; text-decoration: none !important; min-width: 24px; min-height: 24px; padding: 4px; justify-content: center !important; inset-block-start: 50% !important; inset-block-end: auto !important; left: 16px !important; right: auto !important; inset-inline-start: auto !important; inset-inline-end: auto !important; translate: 0 -50% !important; }
      .captcha .credits .cap-credit-label { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    `;
    shadowRoot.append(style);
  }
}

export function CapLoginWidget({ endpoint, locale, onReady, onToken }: CapLoginWidgetProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<CapWidget | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [token, setToken] = useState("");
  const isArabic = locale === "ar";

  useEffect(() => {
    let mounted = true;
    let widget: CapWidget | null = null;
    onReady(false);
    onToken("");
    setToken("");
    setStatus("loading");
    setVerificationFailed(false);

    const handleSolve = (event: CapSolveEvent) => {
      if (!mounted) return;
      setToken(event.detail.token);
      onToken(event.detail.token);
      setVerificationFailed(false);
    };
    const handleReset = (_event: CapResetEvent) => {
      if (mounted) {
        setToken("");
        onToken("");
      }
    };
    const handleError = (_event: CapErrorEvent) => {
      if (!mounted) return;
      setToken("");
      onToken("");
      setVerificationFailed(true);
    };

    import("cap-widget").then(() => {
      if (!mounted || !hostRef.current) return;
      if (!customElements.get("cap-widget")) throw new Error("Cap widget was not registered");

      widget = document.createElement("cap-widget") as CapWidget;
      widget.setAttribute("data-cap-api-endpoint", endpoint);
      widget.setAttribute("data-cap-hidden-field-name", "cap-widget-internal-token");
      widget.setAttribute("data-cap-worker-count", "4");
      widget.setAttribute("data-cap-disable-haptics", "");
      widget.setAttribute("data-cap-i18n-initial-state", isArabic ? "تحقق أنك إنسان" : "Vérifiez que vous êtes humain");
      widget.setAttribute("data-cap-i18n-verifying-label", isArabic ? "جارٍ التحقق…" : "Vérification…");
      widget.setAttribute("data-cap-i18n-solved-label", isArabic ? "تم التحقق" : "Vérifié");
      widget.setAttribute("data-cap-i18n-error-label", isArabic ? "تعذر التحقق، أعد المحاولة" : "Échec, réessayez");
      widget.setAttribute("data-cap-i18n-troubleshooting-label", isArabic ? "استكشاف الأخطاء" : "Dépannage");
      widget.setAttribute("data-cap-i18n-verify-aria-label", isArabic ? "اضغط للتحقق" : "Cliquer pour vérifier");
      widget.setAttribute("data-cap-i18n-verifying-aria-label", isArabic ? "جارٍ التحقق، يرجى الانتظار" : "Vérification en cours, veuillez patienter");
      widget.setAttribute("data-cap-i18n-verified-aria-label", isArabic ? "تم التحقق" : "Vérifié");
      widget.setAttribute("data-cap-i18n-required-label", isArabic ? "يرجى إكمال التحقق الأمني" : "Veuillez terminer la vérification");
      widget.setAttribute("data-cap-i18n-error-aria-label", isArabic ? "حدث خطأ، حاول مجددًا" : "Une erreur est survenue, réessayez");
      widget.setAttribute("required", "");
      widget.style.display = "block";
      widget.style.width = "100%";
      widget.style.minHeight = "58px";
      widget.style.setProperty("--cap-widget-width", "100%");
      widget.style.setProperty("--cap-widget-height", "58px");
      widget.style.setProperty("--cap-widget-padding", "12px");
      widget.style.setProperty("--cap-background", "hsl(var(--card))");
      widget.style.setProperty("--cap-border-color", "hsl(var(--border))");
      widget.style.setProperty("--cap-border-radius", "10px");
      widget.style.setProperty("--cap-color", "hsl(var(--foreground))");
      widget.style.setProperty("--cap-font", "inherit");
      widget.style.setProperty("--cap-spinner-color", "var(--club-primary)");
      widget.style.setProperty("--cap-checkbox-border", "1px solid hsl(var(--border))");
      widget.style.setProperty("--cap-checkbox-background", "hsl(var(--background))");
      widget.addEventListener("solve", handleSolve);
      widget.addEventListener("reset", handleReset);
      widget.addEventListener("error", handleError);
      widgetRef.current = widget;
      hostRef.current.replaceChildren(widget);

      // The package registers a custom element. Mounting it after registration
      // (instead of hydrating the custom tag from server HTML) guarantees its
      // connectedCallback builds the original shadow-DOM widget before we
      // enable login or remove the loading state.
      requestAnimationFrame(() => {
        if (!mounted) return;
        if (widget?.shadowRoot?.querySelector(".captcha-trigger")) {
          applyCapCreditIcon(widget);
          setStatus("ready");
          onReady(true);
        } else {
          setStatus("failed");
          onReady(false);
        }
      });
    }).catch(() => {
      if (!mounted) return;
      setStatus("failed");
      onReady(false);
    });

    return () => {
      mounted = false;
      onReady(false);
      widget?.removeEventListener("solve", handleSolve);
      widget?.removeEventListener("reset", handleReset);
      widget?.removeEventListener("error", handleError);
      widget?.remove();
      if (widgetRef.current === widget) widgetRef.current = null;
    };
  }, [endpoint, isArabic, onReady, onToken]);

  return (
    <div className="min-h-[58px] w-full">
      {status !== "ready" && (
        <div role={status === "failed" || verificationFailed ? "alert" : "status"} className="flex min-h-[58px] items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
          <span>{verificationFailed
            ? (isArabic ? "تعذر إكمال التحقق. اضغط على الكابتشا وحاول مجددًا." : "La vérification a échoué. Cliquez sur le CAPTCHA et réessayez.")
            : status === "failed"
              ? (isArabic ? "تعذر تحميل التحقق الأمني. حدّث الصفحة وحاول مجددًا." : "Impossible de charger la vérification. Actualisez la page et réessayez.")
              : (isArabic ? "جارٍ تحميل التحقق الأمني…" : "Chargement de la vérification…")}</span>
          {status === "failed" && <button type="button" onClick={() => window.location.reload()} className="shrink-0 font-semibold text-club-primary underline underline-offset-2">{isArabic ? "إعادة المحاولة" : "Réessayer"}</button>}
        </div>
      )}
      <div ref={hostRef} className={status === "ready" ? "w-full" : "hidden"} />
      {status === "ready" && verificationFailed && <p role="alert" className="mt-1 text-xs text-destructive">{isArabic ? "تعذر إكمال التحقق. اضغط على الكابتشا وحاول مجددًا." : "La vérification a échoué. Cliquez sur le CAPTCHA et réessayez."}</p>}
      <input type="hidden" name="cap-token" value={token} readOnly />
    </div>
  );
}
