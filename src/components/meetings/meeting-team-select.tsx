"use client";

import { Layers } from "lucide-react";
import { MasterFilterSelect, type MasterFilterOption } from "@/components/shared/master-filter-select";

export function MeetingTeamSelect({ value, options, locale }: { value: string; options: MasterFilterOption[]; locale: string }) {
  const isArabic = locale === "ar";

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {isArabic ? "الفئة المعنية" : "Catégorie concernée"}
      </label>
      <MasterFilterSelect
        name="teamId"
        value={value}
        options={options}
        locale={isArabic ? "ar" : "fr"}
        icon={Layers}
        iconSize="prominent"
        emphasizeValue
        surface="muted"
        headerTitle={isArabic ? "اختر الفئة" : "Choisir une catégorie"}
        className="w-full [&>button]:w-full [&>button]:justify-between"
        align="end"
      />
    </div>
  );
}
