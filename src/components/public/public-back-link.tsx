import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

/** Consistent back navigation for all public detail pages. */
export function PublicBackLink({
  locale,
  href,
  children
}: {
  locale: string;
  href: string;
  children: ReactNode;
}) {
  const isArabic = locale === "ar";
  const Arrow = isArabic ? ArrowRight : ArrowLeft;

  return (
    <Link
      href={href}
      aria-label={typeof children === "string" ? children : undefined}
      className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-card/80 text-foreground shadow-xs transition-[background-color,border-color,color,transform] hover:-translate-y-0.5 hover:border-club-primary/50 hover:bg-club-primary/10 hover:text-club-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/50 sm:h-10 sm:w-auto sm:min-h-10 sm:gap-2.5 sm:rounded-full sm:px-4 sm:py-2 sm:text-sm sm:font-semibold"
    >
      <Arrow className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      <span className="hidden sm:inline">{children}</span>
    </Link>
  );
}
