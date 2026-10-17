"use client";

import { useEffect, useRef, useState } from "react";
import type Cap from "cap-widget";

type CapLoginWidgetProps = {
  endpoint: string;
  locale: string;
  onReady: (ready: boolean) => void;
  onToken: (token: string) => void;
};

export function CapLoginWidget({ endpoint, locale, onReady, onToken }: CapLoginWidgetProps) {
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [solving, setSolving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [solved, setSolved] = useState(false);
  const [token, setToken] = useState("");
  const [verificationFailed, setVerificationFailed] = useState(false);
  const solver = useRef<Cap | null>(null);
  const isArabic = locale === "ar";

  useEffect(() => {
    let mounted = true;
    onReady(false);

    import("cap-widget").then(() => {
      if (!mounted) return;
      setLoaded(true);
      setLoadFailed(false);
      onReady(true);
    }).catch(() => {
      if (!mounted) return;
      setLoadFailed(true);
      onReady(false);
    });

    return () => {
      mounted = false;
      onReady(false);
      if (solver.current) {
        solver.current.reset();
        solver.current.widget.remove();
        solver.current = null;
      }
    };
  }, [endpoint, onReady]);

  const startVerification = async () => {
    if (!loaded || solving || solved) return;
    setSolving(true);
    setProgress(0);
    setVerificationFailed(false);
    setToken("");
    onToken("");

    try {
      const { default: CapWidget } = await import("cap-widget");
      const instance = new CapWidget({ apiEndpoint: endpoint });
      solver.current = instance;
      const handleProgress = (event: CustomEvent<{ progress: number }>) => {
        setProgress(Math.max(0, Math.min(99, Math.round(event.detail.progress))));
      };
      instance.widget.addEventListener("progress", handleProgress);

      try {
        const result = await instance.solve();
        instance.widget.removeEventListener("progress", handleProgress);
        if (!result.success || !result.token) throw new Error("Cap did not return a token");
        setToken(result.token);
        onToken(result.token);
        setSolved(true);
        setProgress(100);
      } catch (error) {
        instance.widget.removeEventListener("progress", handleProgress);
        throw error;
      }
    } catch {
      if (solver.current) {
        solver.current.reset();
        solver.current.widget.remove();
        solver.current = null;
      }
      setVerificationFailed(true);
      onToken("");
    } finally {
      setSolving(false);
    }
  };

  if (!loaded || loadFailed) {
    return (
      <div role={loadFailed ? "alert" : "status"} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
        <span>{loadFailed
          ? (isArabic ? "تعذر تحميل التحقق الأمني." : "Impossible de charger la vérification.")
          : (isArabic ? "جارٍ تحميل التحقق الأمني…" : "Chargement de la vérification…")}</span>
        {loadFailed && <button type="button" onClick={() => window.location.reload()} className="shrink-0 font-semibold text-club-primary underline underline-offset-2">
          {isArabic ? "إعادة المحاولة" : "Réessayer"}
        </button>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-2">
      <button
        type="button"
        onClick={startVerification}
        disabled={solving || solved}
        aria-live="polite"
        className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-border bg-card px-3 text-start text-sm text-foreground transition-colors hover:bg-muted/70 disabled:cursor-default"
      >
        <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${solved ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/60 bg-background"}`}>
          {solved ? <span className="text-xs font-bold">✓</span> : solving ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-club-primary border-t-transparent" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          {solved
            ? (isArabic ? "تم التحقق بنجاح" : "Vérification réussie")
            : solving
              ? (isArabic ? `جارٍ التحقق… ${progress}%` : `Vérification… ${progress}%`)
              : (isArabic ? "تحقق أنك إنسان" : "Vérifiez que vous êtes humain")}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">Cap</span>
      </button>
      {solving && <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full bg-club-primary transition-[width] duration-150" style={{ width: `${progress}%` }} /></div>}
      <input type="hidden" name="cap-token" value={token} readOnly />
      {verificationFailed && <p role="alert" className="mt-2 text-xs text-destructive">{isArabic ? "تعذر إكمال التحقق. تحقق من اتصالك ثم حاول مجددًا." : "La vérification a échoué. Vérifiez votre connexion et réessayez."}</p>}
    </div>
  );
}
