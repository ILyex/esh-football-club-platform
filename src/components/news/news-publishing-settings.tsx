"use client";

import { useState } from "react";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { FormSelect } from "@/components/ui/form-select";

type NewsPublishingSettingsProps = {
  locale: string;
  statusLabel: string;
  scheduledForLabel: string;
  defaultStatus?: string;
  defaultScheduledFor?: string | Date | null;
  disabled?: boolean;
};

export function NewsPublishingSettings({
  locale,
  statusLabel,
  scheduledForLabel,
  defaultStatus = "DRAFT",
  defaultScheduledFor,
  disabled = false
}: NewsPublishingSettingsProps) {
  const [status, setStatus] = useState(defaultStatus);
  const isArabic = locale === "ar";

  return (
    <>
      <div>
        <label className="mb-1.5 block text-xs font-bold">{statusLabel}</label>
        <FormSelect
          name="status"
          defaultValue={defaultStatus}
          disabled={disabled}
          locale={locale}
          onValueChange={setStatus}
          options={[
            { value: "DRAFT", label: isArabic ? "مخفي / مسودة" : "Masqué / Brouillon" },
            { value: "PUBLISHED", label: isArabic ? "منشور / مرئي" : "Publié / Visible" },
            { value: "SCHEDULED", label: isArabic ? "مجدول" : "Programmé" }
          ]}
        />
      </div>
      {status === "SCHEDULED" && (
        <DateTimeInput label={scheduledForLabel} name="scheduledFor" locale={locale} defaultValue={defaultScheduledFor} required disabled={disabled} />
      )}
    </>
  );
}
