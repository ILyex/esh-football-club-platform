"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export function NewsTagsInput({ name, locale, defaultValue, disabled = false }: { name: string; locale: string; defaultValue?: string | null; disabled?: boolean }) {
  const isArabic = locale === "ar";
  const [tags, setTags] = useState(() => (defaultValue ?? "").split(/[,،]/).map((tag) => tag.trim()).filter(Boolean));
  const [draft, setDraft] = useState("");
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = hiddenInputRef.current?.form;
    if (!form || defaultValue) return;
    const handleReset = () => {
      setTags([]);
      setDraft("");
    };
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [defaultValue]);

  const addTag = () => {
    const additions = draft.split(/[,،]/).map((tag) => tag.trim()).filter(Boolean);
    if (!additions.length) return;
    setTags((current) => {
      const known = new Set(current.map((tag) => tag.toLocaleLowerCase()));
      return [...current, ...additions.filter((tag) => {
        const key = tag.toLocaleLowerCase();
        if (known.has(key)) return false;
        known.add(key);
        return true;
      })];
    });
    setDraft("");
  };

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 transition-colors focus-within:border-club-primary focus-within:ring-2 focus-within:ring-club-primary/15"
    >
      <input ref={hiddenInputRef} type="hidden" name={name} value={tags.join(", ")} />
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag, index) => (
          <span key={`${tag}-${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-club-primary/25 bg-club-primary/10 px-2.5 py-1 text-xs font-semibold text-club-primary">
            <span className="max-w-48 truncate">{tag}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => setTags((current) => current.filter((_, tagIndex) => tagIndex !== index))}
                className="inline-flex h-4 w-4 items-center justify-center rounded text-club-primary/75 hover:bg-club-primary/15 hover:text-club-primary"
                aria-label={isArabic ? `حذف الوسم ${tag}` : `Retirer le tag ${tag}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        <input
          value={draft}
          disabled={disabled}
          dir={isArabic ? "rtl" : "ltr"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "," || event.key === "،") {
              event.preventDefault();
              addTag();
            } else if (event.key === "Backspace" && !draft && tags.length > 0) {
              setTags((current) => current.slice(0, -1));
            }
          }}
          placeholder={isArabic ? "اكتب الوسم واضغط Enter" : "Saisissez un tag puis appuyez sur Entrée"}
          className="min-w-32 flex-1 border-0 bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-0 disabled:opacity-60"
        />
      </div>
    </div>
  );
}
