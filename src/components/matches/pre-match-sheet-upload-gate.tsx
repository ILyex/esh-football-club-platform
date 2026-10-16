import type { ReactNode } from "react";

export function PreMatchSheetUploadGate({
  status,
  locale,
  children
}: {
  status: string;
  locale: string;
  children: ReactNode;
}) {
  const isAr = locale === "ar";
  if (status === "LIVE" || status === "SCHEDULED") return children;

  return (
    <p className="rounded-lg border border-dashed border-border bg-background/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground" role="status">
      {isAr
        ? "يتاح رفع ورقة المباراة ما دامت مجدولة أو أثناء المباراة الجارية."
        : "La feuille peut être déposée tant que le match est programmé ou en cours."}
    </p>
  );
}
