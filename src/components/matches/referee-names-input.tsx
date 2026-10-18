"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { getRefereeRoleLabel, splitRefereeNames } from "@/lib/matches/referees";

interface RefereeNamesInputProps {
  name: string;
  defaultValue?: string | null;
  locale: string;
  disabled?: boolean;
  showOrderHint?: boolean;
  nameDirection?: "rtl" | "ltr";
}

export function RefereeNamesInput({ name, defaultValue, locale, disabled = false, showOrderHint = true, nameDirection }: RefereeNamesInputProps) {
  const isAr = locale === "ar";
  const textDirection = nameDirection ?? (isAr ? "rtl" : "ltr");
  const [names, setNames] = useState(() => splitRefereeNames(defaultValue));
  const [draft, setDraft] = useState("");

  const addNames = () => {
    const candidates = draft.split(/[,،]/).map((item) => item.trim()).filter(Boolean);
    if (!candidates.length) return;
    setNames((current) => {
      const known = new Set(current.map((item) => item.toLocaleLowerCase()));
      const additions = candidates.filter((item) => {
        const key = item.toLocaleLowerCase();
        if (known.has(key)) return false;
        known.add(key);
        return true;
      });
      return [...current, ...additions].slice(0, 3);
    });
    setDraft("");
  };

  return (
    <div>
      {showOrderHint && <p className="mb-1.5 text-[11px] text-muted-foreground">
        {isAr ? "ترتيب الأسماء: الحكم الرئيسي، ثم حكما التماس." : "Ordre : arbitre principal, puis les deux assistants."}
      </p>}
      <div dir={isAr ? "rtl" : "ltr"} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 transition-colors focus-within:border-club-primary focus-within:ring-2 focus-within:ring-club-primary/15">
      <input type="hidden" name={name} value={names.join(", ")} />
      <div className="flex flex-wrap items-center gap-2">
        {names.map((referee, index) => (
          <span key={`${referee}-${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-club-primary/25 bg-club-primary/10 px-2.5 py-1 text-xs font-semibold text-club-primary">
            <span className="text-[10px] font-medium text-muted-foreground">{getRefereeRoleLabel(index, locale)}:</span>
            <span dir={textDirection} className="max-w-48 truncate">{referee}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => setNames((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                className="inline-flex h-4 w-4 items-center justify-center rounded text-club-primary/75 hover:bg-club-primary/15 hover:text-club-primary"
                aria-label={isAr ? `حذف الحكم ${referee}` : `Retirer l’arbitre ${referee}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        <span className="ms-auto text-[10px] font-medium text-muted-foreground">{names.length}/3</span>
        <input
          value={draft}
          disabled={disabled || names.length >= 3}
          dir={textDirection}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "," || event.key === "،") {
              event.preventDefault();
              addNames();
            } else if (event.key === "Backspace" && !draft && names.length > 0) {
              setNames((current) => current.slice(0, -1));
            }
          }}
          placeholder={names.length >= 3 ? (isAr ? "اكتمل طاقم الحكام" : "Équipe arbitrale complète") : (isAr ? "اكتب اسم الحكم واضغط Enter" : "Saisissez un nom puis appuyez sur Entrée")}
          className="min-w-40 flex-1 border-0 bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-0 disabled:opacity-60"
        />
      </div>
      </div>
    </div>
  );
}
