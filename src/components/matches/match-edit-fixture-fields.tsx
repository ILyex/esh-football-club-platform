"use client";

import { useEffect, useRef, useState } from "react";
import { hasArabicScript } from "@/lib/public/locale-text";

export function MatchEditFixtureFields({
  initialIsHome,
  initialStadium,
  canUpdate,
  locale,
  stadiumLabel
}: {
  initialIsHome: boolean;
  initialStadium: string;
  canUpdate: boolean;
  locale: string;
  stadiumLabel: string;
}) {
  const isAr = locale === "ar";
  const homeStadium = "الملعب البلدي طاهري حسني – سيدي حسني";
  const [isHome, setIsHome] = useState(initialIsHome);
  const [stadium, setStadium] = useState(initialStadium || (initialIsHome ? homeStadium : ""));
  const awayStadium = useRef(initialIsHome ? "" : initialStadium);
  const displayedStadium = !isAr && hasArabicScript(stadium)
    ? (isHome ? "Stade communal Taheri Hosni – Sidi Hosni" : "Stade à confirmer")
    : stadium;

  useEffect(() => {
    setIsHome(initialIsHome);
    setStadium(initialStadium || (initialIsHome ? homeStadium : ""));
    awayStadium.current = initialIsHome ? "" : initialStadium;
  }, [initialIsHome, initialStadium, homeStadium]);

  function selectFixture(nextIsHome: boolean) {
    if (nextIsHome === isHome) return;
    if (nextIsHome) {
      if (!isHome) awayStadium.current = stadium;
      setStadium(homeStadium);
    } else {
      setStadium(awayStadium.current);
    }
    setIsHome(nextIsHome);
  }

  return (
    <div className="grid min-w-0 gap-4 2xl:col-span-2 2xl:grid-cols-2">
      <div className="min-w-0 rounded-xl border border-border/70 bg-background/30 p-3">
        <p className="mb-2 text-xs font-bold text-muted-foreground">{isAr ? "مكان إقامة المباراة" : "Lieu de la rencontre"}</p>
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label={isAr ? "موقع اللقاء: مضيف أم ضيف؟" : "Lieu du match : domicile ou extérieur ?"}>
        <label className="cursor-pointer">
          <input name="isHomeFixture" type="radio" value="true" checked={isHome} onChange={() => selectFixture(true)} disabled={!canUpdate} className="peer sr-only" />
          <span className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold text-muted-foreground transition-all hover:bg-muted peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-xs peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
            {isAr ? "مضيف (بملعبنا)" : "Domicile"}
          </span>
        </label>
        <label className="cursor-pointer">
          <input name="isHomeFixture" type="radio" value="false" checked={!isHome} onChange={() => selectFixture(false)} disabled={!canUpdate} className="peer sr-only" />
          <span className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold text-muted-foreground transition-all hover:bg-muted peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-xs peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
            {isAr ? "ضيف (خارج الديار)" : "Extérieur"}
          </span>
        </label>
        </div>
      </div>
      <div className="min-w-0 rounded-xl border border-border/70 bg-background/30 p-3">
        <label className="mb-2 block text-xs font-bold text-muted-foreground">{stadiumLabel}</label>
        <input name="stadium" type="hidden" value={stadium} disabled={!canUpdate} />
        <input
          id="match-stadium"
          type="text"
          value={displayedStadium}
          onChange={(event) => {
            setStadium(event.target.value);
            if (!isHome) awayStadium.current = event.target.value;
          }}
          readOnly={isHome}
          disabled={!canUpdate}
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 read-only:cursor-not-allowed read-only:opacity-70 disabled:opacity-60"
        />
        <p className="mt-2 min-h-4 text-[11px] leading-4 text-muted-foreground">{isHome ? (isAr ? "يُحدد ملعب النادي تلقائياً للمباراة على أرضنا." : "Le stade du club est défini automatiquement à domicile.") : (isAr ? "أدخل اسم الملعب الذي ستقام عليه المباراة." : "Indiquez le stade où se jouera le match.")}</p>
      </div>
    </div>
  );
}
