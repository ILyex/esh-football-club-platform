"use client";

import { useEffect, useState } from "react";

export function MatchPeriodOptions({
  locale,
  initialExtraTime,
  initialShootout,
  addedTime = { firstHalf: 0, secondHalf: 0, extraTimeFirstHalf: 0, extraTimeSecondHalf: 0 },
  disabled = false
}: {
  locale: string;
  initialExtraTime: boolean;
  initialShootout: boolean;
  addedTime?: { firstHalf: number; secondHalf: number; extraTimeFirstHalf: number; extraTimeSecondHalf: number };
  disabled?: boolean;
}) {
  const isAr = locale === "ar";
  const [extraTime, setExtraTime] = useState(initialExtraTime || initialShootout);
  const [shootout, setShootout] = useState(initialShootout);

  useEffect(() => {
    setExtraTime(initialExtraTime || initialShootout);
    setShootout(initialShootout);
  }, [initialExtraTime, initialShootout]);

  return (
    <div className="rounded-xl border border-border/70 bg-background/30 p-3 2xl:col-span-2">
      <input type="hidden" name="hasExtraTime" value={extraTime ? "true" : "false"} />
      <input type="hidden" name="hasPenaltyShootout" value={shootout ? "true" : "false"} />
      <p className="mb-2 text-xs font-bold text-muted-foreground">{isAr ? "نظام الوقت" : "Périodes du match"}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm has-[:checked]:border-club-primary/40 has-[:checked]:bg-club-primary/5">
          <input type="checkbox" checked={extraTime} disabled={disabled} onChange={(event) => { setExtraTime(event.target.checked); if (!event.target.checked) setShootout(false); }} className="mt-0.5 accent-club-primary" />
          <span><strong className="block text-xs text-foreground">{isAr ? "شوطان إضافيان" : "Deux périodes de prolongation"}</strong><small className="mt-0.5 block text-[11px] text-muted-foreground">{isAr ? "يمتد وقت اللعب من 90 إلى 120 دقيقة." : "Le temps de jeu passe de 90 à 120 minutes."}</small></span>
        </label>
        <label className={`flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm has-[:checked]:border-club-primary/40 has-[:checked]:bg-club-primary/5 ${!extraTime ? "opacity-50" : "cursor-pointer"}`}>
          <input type="checkbox" checked={shootout} disabled={disabled || !extraTime} onChange={(event) => setShootout(event.target.checked)} className="mt-0.5 accent-club-primary" />
          <span><strong className="block text-xs text-foreground">{isAr ? "ركلات الترجيح عند التعادل" : "Tirs au but en cas d’égalité"}</strong><small className="mt-0.5 block text-[11px] text-muted-foreground">{isAr ? "تُسجّل ركلات كل لاعب بعد نهاية الوقت الإضافي." : "Les tirs des joueurs sont enregistrés après la prolongation."}</small></span>
        </label>
      </div>
      <div className="mt-3 border-t border-border/60 pt-3">
        <p className="mb-2 text-[11px] font-semibold text-muted-foreground">{isAr ? "الوقت الضائع المتوقع (بالدقائق)" : "Temps additionnel prévu (minutes)"}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ["firstHalfAddedTime", isAr ? "الشوط الأول" : "1re mi-temps", addedTime.firstHalf],
            ["secondHalfAddedTime", isAr ? "الشوط الثاني" : "2e mi-temps", addedTime.secondHalf],
            ["extraTimeFirstHalfAddedTime", isAr ? "الإضافي الأول" : "1re prolongation", addedTime.extraTimeFirstHalf],
            ["extraTimeSecondHalfAddedTime", isAr ? "الإضافي الثاني" : "2e prolongation", addedTime.extraTimeSecondHalf]
          ] as const).map(([name, label, value]) => (
            <label key={name} className="min-w-0">
              <span className="mb-1 block truncate text-[10px] font-medium text-muted-foreground">{label}</span>
              <input
                type="number"
                name={name}
                min={0}
                max={15}
                step={1}
                defaultValue={value}
                disabled={disabled}
                inputMode="numeric"
                className="h-9 w-full rounded-lg border border-border bg-card px-2 text-sm font-semibold tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-club-primary/20 disabled:opacity-60"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
          {isAr ? "تُعرض في الساعة بصيغة 45+2 و90+4، وتؤخر الانتقال التلقائي للمرحلة التالية." : "Affiché comme 45+2 ou 90+4 et décale la transition automatique vers la période suivante."}
        </p>
      </div>
    </div>
  );
}
