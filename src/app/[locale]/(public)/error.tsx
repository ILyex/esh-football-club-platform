"use client";

import { usePathname } from "next/navigation";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function PublicSiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  const isFrench = pathname.startsWith("/fr/") || pathname === "/fr";

  return (
    <main
      dir={isFrench ? "ltr" : "rtl"}
      className="mx-auto flex min-h-[55vh] w-full max-w-3xl flex-col items-center justify-center px-5 py-16 text-center"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
        <AlertTriangle className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-black text-foreground">
        {isFrench ? "Cette page est temporairement indisponible" : "الصفحة غير متاحة مؤقتًا"}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
        {isFrench
          ? "Un problème temporaire a interrompu le chargement. Réessayez ou revenez à l’accueil."
          : "حدثت مشكلة مؤقتة أثناء تحميل الصفحة. أعد المحاولة أو ارجع إلى الرئيسية."}
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-club-primary px-5 text-sm font-bold text-white transition-colors hover:bg-club-primary-hover"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {isFrench ? "Réessayer" : "إعادة المحاولة"}
        </button>
        <a
          href={`/${isFrench ? "fr" : "ar"}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          {isFrench ? "Accueil" : "الرئيسية"}
        </a>
      </div>
    </main>
  );
}
