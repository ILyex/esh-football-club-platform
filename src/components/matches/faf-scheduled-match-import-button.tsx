"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importUpcomingFafMatchesAction } from "@/app/[locale]/(dashboard)/dashboard/matches/actions";

export function FafScheduledMatchImportButton({ locale, compact = false }: { locale: string; compact?: boolean }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const importMatches = () => startTransition(async () => {
    try {
      const result = await importUpcomingFafMatchesAction();
      if (result.created > 0) {
        toast.success(ar
          ? `تم جلب ${result.created} مباراة جديدة. تم تجاوز ${result.alreadyPresent} مباراة موجودة.`
          : `${result.created} match(s) imported. ${result.alreadyPresent} déjà présent(s).`);
      } else {
        toast.info(ar
          ? `اكتمل فحص ${result.scanned} مباراة؛ أضيفت ${result.created}، والموجود مسبقًا ${result.alreadyPresent}.`
          : `${result.scanned} rencontre(s) vérifiée(s) : ${result.created} ajoutée(s), ${result.alreadyPresent} déjà présente(s).`);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (ar ? "تعذر جلب المباريات من FAF EMS." : "Impossible d’importer les matchs depuis FAF EMS."));
    }
  });

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "space-y-2"}>
      <Button type="button" size={compact ? "sm" : "default"} variant="outline" onClick={importMatches} disabled={pending}>
        {pending ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Download className="me-2 h-4 w-4" />}
        {pending ? (ar ? "جارٍ البحث في FAF EMS…" : "Recherche dans FAF EMS…") : (ar ? (compact ? "جلب من FAF EMS" : "جلب المباراة من FAF EMS") : "Importer les matchs FAF EMS")}
      </Button>
      {!compact && <p className="text-xs text-muted-foreground">
        {ar ? "يفحص سجل FAF EMS للمباريات السابقة ومباريات الأيام الـ14 القادمة، ويتجاوز أي مباراة موجودة مسبقًا." : "Recherche l’historique FAF EMS et les rencontres des 14 prochains jours, en ignorant les matchs déjà présents."}
      </p>}
    </div>
  );
}
