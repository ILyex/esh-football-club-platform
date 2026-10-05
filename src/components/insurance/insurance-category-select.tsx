"use client";

import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";

export interface InsuranceCategorySelectProps {
  locale: string;
  value: string;
  status?: string;
  options: Array<{ id: string; label: string }>;
}

/**
 * Custom dropdown menu for switching sports insurance categories.
 * Powered by MasterFilterSelect adhering strictly to Master Component standards.
 */
export function InsuranceCategorySelect({ locale, value, status, options }: InsuranceCategorySelectProps) {
  const router = useRouter();
  const isAr = locale === "ar";

  const allOptionLabel = isAr ? "كل الفئات (الإجمالي)" : "Toutes les catégories";
  const selectOptions = [
    { id: "ALL", label: allOptionLabel },
    ...options.map((o) => ({ id: o.id, label: o.label })),
  ];

  const handleSelect = (teamId: string) => {
    const qs = new URLSearchParams();
    if (teamId !== "ALL") qs.set("team", teamId);
    if (status) qs.set("status", status);
    const queryStr = qs.toString();
    router.push(`/${locale}/dashboard/insurance${queryStr ? `?${queryStr}` : ""}`);
  };

  return (
    <MasterFilterSelect
      label={isAr ? "الفئة:" : "Catégorie :"}
      locale={isAr ? "ar" : "fr"}
      value={value || "ALL"}
      options={selectOptions}
      onChange={handleSelect}
      icon={Layers}
      iconSize="default"
      headerTitle={isAr ? "اختيار الفئة الرياضية" : "Filtrer par catégorie"}
      placeholder={allOptionLabel}
      align="end"
      className="insurance-category-select"
    />
  );
}
