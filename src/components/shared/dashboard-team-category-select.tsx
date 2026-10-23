"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";

export interface DashboardTeamCategorySelectProps {
  value: string;
  options: Array<{ id: string; label: string }>;
  allLabel: string;
  locale: string;
  label?: string;
  canSelectAll?: boolean;
}

/** Team/category filter styled like the sports insurance category selector. */
export function DashboardTeamCategorySelect({ value, options, allLabel, locale, label, canSelectAll = true }: DashboardTeamCategorySelectProps) {
  const pathname = usePathname();
  const router = useRouter();
  const teamInputRef = useRef<HTMLInputElement>(null);

  // Keep the category menu in the same sporting order everywhere, regardless
  // of the order in which the database returns the teams.
  const categoryOrder = ["SENIOR", "U20", "U17", "U15"];
  const categoryRank = (option: { id: string; label: string }) => {
    const normalized = option.label.normalize("NFKC").toLocaleLowerCase();
    if (/séniors|seniors|الأكابر/.test(normalized)) return 0;
    const youthCategory = normalized.match(/u\s*(20|17|15)/)?.[1];
    if (youthCategory) return categoryOrder.indexOf(`U${youthCategory}`);
    return categoryOrder.length;
  };
  const orderedOptions = options
    .map((option, index) => ({ option, index }))
    .sort((a, b) => categoryRank(a.option) - categoryRank(b.option) || a.index - b.index)
    .map(({ option }) => option);

  const handleChange = (teamId: string) => {
    if (teamInputRef.current) teamInputRef.current.value = teamId;
    const params = new URLSearchParams(window.location.search);
    if (teamId === "ALL") params.delete("team");
    else params.set("team", teamId);
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}`);
  };

  return (
    <>
      <input ref={teamInputRef} type="hidden" name="team" value={value || (canSelectAll ? "ALL" : (options[0]?.id ?? ""))} readOnly />
      <MasterFilterSelect
        label={label ?? (locale === "ar" ? "الفئة:" : "Catégorie :")}
        locale={locale === "ar" ? "ar" : "fr"}
        value={value || (canSelectAll ? "ALL" : (options[0]?.id ?? ""))}
        options={[...(canSelectAll ? [{ id: "ALL", label: allLabel }] : []), ...orderedOptions]}
        disabled={!canSelectAll && options.length === 0}
        onChange={handleChange}
        hideIcon
        headerTitle={locale === "ar" ? "اختيار الفئة الرياضية" : "Filtrer par catégorie"}
        placeholder={allLabel}
        align="end"
      />
    </>
  );
}
