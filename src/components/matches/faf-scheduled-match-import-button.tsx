"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importUpcomingFafMatchesAction } from "@/app/[locale]/(dashboard)/dashboard/matches/actions";

export function FafScheduledMatchImportButton({ locale }: { locale: string }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [warnings, setWarnings] = useState<string[]>([]);

  const importMatches = () => startTransition(async () => {
    setWarnings([]);
    try {
      const result = await importUpcomingFafMatchesAction();
      setWarnings(result.warnings);
      if (result.created > 0) {
        toast.success(ar
          ? `تم جلب ${result.created} مباراة جديدة. تم تجاوز ${result.alreadyPresent} مباراة موجودة.`
          : `${result.created} match(s) imported. ${result.alreadyPresent} déjà présent(s).`);
      } else if (result.warnings.length > 0) {
        toast.warning(ar ? "وصلت نتائج FAF EMS، لكن بعض المباريات تحتاج مراجعة." : "FAF EMS a répondu, mais certaines rencontres nécessitent une vérification.");
      } else {
        toast.info(ar
          ? `لم تُضف مباريات جديدة. جرى فحص ${result.scanned} مباراة؛ الموجود مسبقًا: ${result.alreadyPresent}.`
          : `Aucun nouveau match. ${result.scanned} rencontre(s) vérifiée(s), ${result.alreadyPresent} déjà présente(s).`);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (ar ? "تعذر جلب المباريات من FAF EMS." : "Impossible d’importer les matchs depuis FAF EMS."));
    }
  });

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={importMatches} disabled={pending}>
        {pending ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Download className="me-2 h-4 w-4" />}
        {pending ? (ar ? "جارٍ البحث في FAF EMS…" : "Recherche dans FAF EMS…") : (ar ? "جلب المباراة من FAF EMS" : "Importer les matchs FAF EMS")}
      </Button>
      <p className="text-xs text-muted-foreground">
        {ar ? "يفحص المباريات المبرمجة خلال 14 يومًا، وينشئ الناقص فقط دون تعديل مبارياتكم." : "Recherche les rencontres des 14 prochains jours et ajoute uniquement celles qui manquent, sans modifier vos matchs."}
      </p>
      {warnings.length > 0 && <ul className="space-y-1 text-xs text-amber-600" role="status">{warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>}
    </div>
  );
}
