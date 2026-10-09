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
        options={[...(canSelectAll ? [{ id: "ALL", label: allLabel }] : []), ...options]}
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
