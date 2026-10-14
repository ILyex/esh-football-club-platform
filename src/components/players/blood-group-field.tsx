"use client";

import { useState } from "react";
import { FormSelect } from "@/components/ui/form-select";

interface BloodGroupFieldProps {
  label: string;
  locale: string;
  defaultValue?: string | null;
  disabled?: boolean;
}

export function BloodGroupField({ label, locale, defaultValue = "", disabled = false }: BloodGroupFieldProps) {
  const initial = /^(AB|A|B|O)([+-])$/.exec(defaultValue ?? "");
  const [type, setType] = useState(initial?.[1] ?? "");
  const [rh, setRh] = useState(initial?.[2] ?? "");
  const isAr = locale === "ar";

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className={`flex overflow-visible rounded-lg border border-border bg-background ${isAr ? "flex-row-reverse" : ""}`}>
        <div className="min-w-0 flex-1">
          <FormSelect
            name="bloodGroupType"
            value={type}
            onValueChange={setType}
            disabled={disabled}
            locale={locale}
            ariaLabel={label}
            placeholder={isAr ? "الفصيلة" : "Groupe"}
            triggerClassName="min-h-10 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            options={["A", "B", "AB", "O"].map((value) => ({ value, label: value }))}
          />
        </div>
        <div className="w-[4.25rem] shrink-0 border-s border-border">
          <FormSelect
            name="bloodGroupRh"
            value={rh}
            onValueChange={setRh}
            disabled={disabled}
            locale={locale}
            ariaLabel={isAr ? "عامل ريسوس" : "Facteur Rhésus"}
            placeholder="+/−"
            triggerClassName="min-h-10 justify-center rounded-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 [&>span]:text-center"
            options={[
              { value: "+", label: "+" },
              { value: "-", label: "−" }
            ]}
          />
        </div>
        <input type="hidden" name="bloodGroup" value={type && rh ? `${type}${rh}` : ""} />
      </div>
    </div>
  );
}
