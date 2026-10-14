"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, LoaderCircle } from "lucide-react";
import { syncFAFMatchDocumentsAction } from "@/app/[locale]/(dashboard)/dashboard/matches/actions";
import { Button } from "@/components/ui/button";

export function FafEmsSyncButton({ matchId, locale }: { matchId: string; locale: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const ar = locale === "ar";
  return <Button type="button" size="sm" variant="outline" disabled={pending} onClick={async () => {
    setPending(true);
    try {
      const result = await syncFAFMatchDocumentsAction(matchId, locale);
      if (!result.success) throw new Error(result.message);
      toast.success(result.message);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (ar ? "تعذر الاتصال بمنصة FAF EMS." : "Impossible de synchroniser avec FAF EMS."));
    } finally { setPending(false); }
  }}>
    {pending ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Download className="me-2 h-4 w-4" />}
    {pending ? (ar ? "جارٍ الجلب..." : "Synchronisation…") : (ar ? "جلب وثائق FAF EMS" : "Importer les documents FAF EMS")}
  </Button>;
}
