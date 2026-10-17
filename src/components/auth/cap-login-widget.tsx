"use client";

import { useEffect, useState, type CSSProperties } from "react";

type CapLoginWidgetProps = {
  endpoint: string;
  locale: string;
  onReady: (ready: boolean) => void;
};

export function CapLoginWidget({ endpoint, locale, onReady }: CapLoginWidgetProps) {
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const isArabic = locale === "ar";

  useEffect(() => {
    let mounted = true;
    onReady(false);
    import("cap-widget").then(() => {
      if (!mounted) return;
      setLoaded(true);
      onReady(true);
    }).catch(() => {
      if (!mounted) return;
      setLoadFailed(true);
      onReady(false);
    });

    return () => {
      mounted = false;
      onReady(false);
    };
  }, [endpoint, onReady]);

  if (!loaded) {
    return (
      <div role={loadFailed ? "alert" : "status"} className="rounded-xl border border-border bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
        {loadFailed
          ? (isArabic ? "تعذر تحميل التحقق الأمني. حدّث الصفحة وحاول مجددًا." : "Impossible de charger la vérification. Actualisez la page et réessayez.")
          : (isArabic ? "جارٍ تحميل التحقق الأمني…" : "Chargement de la vérification…")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-muted/30 p-2.5">
      <cap-widget
        required
        data-cap-api-endpoint={endpoint}
        data-cap-hidden-field-name="cap-token"
        data-cap-disable-haptics
        data-cap-i18n-initial-state={isArabic ? "تحقق أنك إنسان" : "Vérifiez que vous êtes humain"}
        data-cap-i18n-verifying-label={isArabic ? "جارٍ التحقق…" : "Vérification…"}
        data-cap-i18n-solved-label={isArabic ? "تم التحقق" : "Vérifié"}
        data-cap-i18n-error-label={isArabic ? "خطأ" : "Erreur"}
        data-cap-i18n-troubleshooting-label={isArabic ? "استكشاف الأخطاء" : "Dépannage"}
        data-cap-i18n-verify-aria-label={isArabic ? "اضغط للتحقق" : "Cliquer pour vérifier"}
        data-cap-i18n-verifying-aria-label={isArabic ? "جارٍ التحقق، يرجى الانتظار" : "Vérification en cours, veuillez patienter"}
        data-cap-i18n-verified-aria-label={isArabic ? "تم التحقق" : "Vérifié"}
        data-cap-i18n-required-label={isArabic ? "يرجى إكمال التحقق الأمني" : "Veuillez terminer la vérification"}
        data-cap-i18n-error-aria-label={isArabic ? "حدث خطأ، حاول مجددًا" : "Une erreur est survenue, réessayez"}
        style={{
          "--cap-background": "hsl(var(--card))",
          "--cap-border-color": "hsl(var(--border))",
          "--cap-border-radius": "10px",
          "--cap-widget-width": "100%",
          "--cap-widget-padding": "10px",
          "--cap-color": "hsl(var(--foreground))",
          "--cap-font": "inherit",
          "--cap-spinner-color": "var(--club-primary)",
          "--cap-checkbox-border": "1px solid hsl(var(--border))",
          "--cap-checkbox-background": "hsl(var(--background))"
        } as CSSProperties}
      />
    </div>
  );
}
