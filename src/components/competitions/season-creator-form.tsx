"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";

type SeasonActionState = { id?: string; error?: string } | undefined;
type SeasonAction = (prev: SeasonActionState, formData: FormData) => Promise<SeasonActionState>;

function formatSeasonLabel(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}/${digits.slice(4)}`;
}

export function SeasonCreatorForm({
  locale,
  action
}: {
  locale: string;
  action: SeasonAction;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const isAr = locale === "ar";

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4 items-end">
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">
          {isAr ? "تسمية الموسم" : "Libellé"}
        </label>
        <input
          type="text"
          name="label"
          placeholder="2027/2028"
          inputMode="numeric"
          autoComplete="off"
          required
          onChange={(event) => { event.currentTarget.value = formatSeasonLabel(event.currentTarget.value); }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-club-primary focus:outline-hidden"
        />
        {state?.error && (
          <p className="mt-1 text-[11px] text-destructive">
            {state.error === "season_exists"
              ? (isAr ? "هذا الموسم موجود مسبقًا." : "Cette saison existe déjà.")
              : state.error === "invalid_season_label"
                ? (isAr ? "اكتب الموسم بهذا الشكل: 2027/2028" : "Saisissez la saison au format 2027/2028.")
                : (isAr ? "تعذر حفظ الموسم، تحقق من البيانات." : "Impossible d’enregistrer la saison, vérifiez les données.")}
          </p>
        )}
      </div>
      <DateInput label={isAr ? "تاريخ البداية" : "Date de début"} name="startDate" required locale={locale} />
      <DateInput label={isAr ? "تاريخ النهاية" : "Date de fin"} name="endDate" required locale={locale} />
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="w-full font-bold">
        <Plus className="h-4 w-4 me-1" />
        <span>{pending ? (isAr ? "جارٍ الحفظ..." : "Enregistrement...") : (isAr ? "حفظ الموسم" : "Créer saison")}</span>
      </Button>
    </form>
  );
}
