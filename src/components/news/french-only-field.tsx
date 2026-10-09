"use client";

import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

const ARABIC_SCRIPT = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/gu;

type FrenchOnlyFieldProps = {
  name: string;
  multiline?: boolean;
  required?: boolean;
  defaultValue?: string;
  disabled?: boolean;
  locale?: string;
  placeholder?: string;
};

export function FrenchOnlyField({ name, multiline = false, required = false, defaultValue, disabled = false, locale = "ar", placeholder }: FrenchOnlyFieldProps) {
  const [languageWarning, setLanguageWarning] = useState(false);
  const warningShown = useRef(false);
  const className = multiline
    ? "w-full resize-y rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-7 outline-none focus:border-club-primary focus:ring-2 focus:ring-club-primary/20"
    : "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-club-primary focus:ring-2 focus:ring-club-primary/20";
  const languageMessage = locale === "ar" ? "غيّر لغة الإدخال إلى الفرنسية" : "Veuillez changer la langue de saisie en français";
  const sanitizeInput = (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = event.currentTarget;
    const sanitized = field.value.replace(ARABIC_SCRIPT, "");
    if (field.value !== sanitized) {
      field.value = sanitized;
      setLanguageWarning(true);
      if (!warningShown.current) {
        toast.error(languageMessage);
        warningShown.current = true;
      }
    } else if (!field.value) {
      setLanguageWarning(false);
      warningShown.current = false;
    }
  };

  const languageHint = languageWarning && (
    <p className="block w-full text-end text-[11px] font-medium text-amber-600 dark:text-amber-400" role="status">
      {languageMessage}
    </p>
  );

  if (multiline) {
    return (
      <>
        <textarea
        name={name}
        dir="ltr"
        lang="fr"
        rows={9}
        required={required}
        disabled={disabled}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onInput={sanitizeInput}
        className={className}
        />
        {languageHint}
      </>
    );
  }

  return (
    <>
      <input
      name={name}
      dir="ltr"
      lang="fr"
      required={required}
      disabled={disabled}
      defaultValue={defaultValue}
      placeholder={placeholder}
      onInput={sanitizeInput}
      className={className}
      />
      {languageHint}
    </>
  );
}
