import type { ReactNode } from "react";
import { PublicBackLink } from "@/components/public/public-back-link";

/** Shared heading hierarchy for the public website, including detail routes. */
export function PublicPageHeading({
  locale,
  eyebrow,
  title,
  icon,
  description,
  backHref,
  backLabel,
  trailing,
  className = ""
}: {
  locale: string;
  eyebrow: ReactNode;
  title: ReactNode;
  icon: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <header
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`border-b border-border/80 pb-5 sm:pb-7 ${className}`}
    >
      {backHref && backLabel && (
        <div className="mb-5 sm:mb-6">
          <PublicBackLink locale={locale} href={backHref}>
            {backLabel}
          </PublicBackLink>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-club-primary/20 bg-club-primary/10 px-3 py-1.5 text-[11px] font-bold text-club-primary sm:text-xs">
            <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden="true">{icon}</span>
            <span className="truncate">{eyebrow}</span>
          </span>
          <h1 className="mt-3 break-words text-[clamp(1.65rem,5vw,2.75rem)] font-black leading-[1.2] tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          )}
        </div>
        {trailing && <div className="flex shrink-0 flex-wrap items-center gap-2">{trailing}</div>}
      </div>
    </header>
  );
}
