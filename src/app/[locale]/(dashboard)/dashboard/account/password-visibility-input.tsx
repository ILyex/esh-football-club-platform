"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordVisibilityInputProps {
  name: string;
  autoComplete: "current-password" | "new-password";
  locale: string;
  showLabel: string;
  hideLabel: string;
}

export function PasswordVisibilityInput({
  name,
  autoComplete,
  locale,
  showLabel,
  hideLabel
}: PasswordVisibilityInputProps) {
  const [visible, setVisible] = useState(false);
  const isRtl = locale === "ar";

  return (
    <span className="relative block" dir={isRtl ? "rtl" : "ltr"}>
      <input
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={8}
        maxLength={72}
        required
        className="h-11 w-full rounded-xl border border-border bg-background px-3 pe-11 outline-none focus:border-club-primary focus:ring-2 focus:ring-club-primary/15"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute inset-y-0 end-2 inline-flex w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </span>
  );
}
