"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "./actions";

export function MarkAllReadButton({
  label,
  errorLabel
}: {
  label: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hasError, setHasError] = useState(false);

  function handleClick() {
    if (isPending) return;
    setHasError(false);
    startTransition(async () => {
      try {
        await markAllNotificationsReadAction();
        router.refresh();
      } catch {
        setHasError(true);
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        className="gap-1.5 text-xs font-semibold"
        onClick={handleClick}
        disabled={isPending}
        aria-busy={isPending}
      >
        <CheckCheck className="h-4 w-4 text-emerald-600" />
        <span>{label}</span>
      </Button>
      {hasError && (
        <span role="alert" className="text-xs text-destructive">
          {errorLabel}
        </span>
      )}
    </div>
  );
}
