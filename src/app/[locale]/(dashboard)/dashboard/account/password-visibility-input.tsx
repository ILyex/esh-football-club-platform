"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordVisibilityInputProps {
  name: string;
  autoComplete: "current-password" | "new-password";
  showLabel: string;
  hideLabel: string;
}

export function PasswordVisibilityInput({
  name,
  autoComplete,
  showLabel,
  hideLabel
}: PasswordVisibilityInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block" dir="ltr">
      <input
        name={name}
        type={visible ? "text" : "password"}
        dir="ltr"
        autoComplete={autoComplete}
        minLength={8}
        maxLength={72}
        required
        className="h-11 w-full rounded-xl border border-border bg-background py-2 pl-3 pr-12 text-left text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-club-primary focus:ring-2 focus:ring-club-primary/15"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-border/70 bg-muted/60 text-muted-foreground transition-colors hover:border-club-primary/30 hover:bg-club-primary/10 hover:text-club-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </span>
  );
}
