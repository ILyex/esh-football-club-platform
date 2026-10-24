"use client";

import { useState } from "react";
import { FormSelect } from "@/components/ui/form-select";

type RecordType = "MEDICAL_CLEARANCE" | "DRUG_TEST_RESULT" | "LAB_ANALYSIS";

export function MedicalRecordTypeStatusFields({
  locale,
  recordTypes,
  medicalStatuses
}: {
  locale: string;
  recordTypes: Array<{ value: RecordType; label: string }>;
  medicalStatuses: Array<{ value: string; label: string }>;
}) {
  const isAr = locale === "ar";
  const [type, setType] = useState<RecordType>("MEDICAL_CLEARANCE");
  const [status, setStatus] = useState("PENDING");
  const drugStatuses = [
    { value: "", label: isAr ? "اختر نتيجة الفحص" : "Choisir le résultat" },
    { value: "UNFIT", label: isAr ? "إيجابي" : "Positif" },
    { value: "FIT", label: isAr ? "سلبي" : "Négatif" }
  ];

  const statusOptions = type === "DRUG_TEST_RESULT" ? drugStatuses : medicalStatuses;

  return <>
    <label className="flex min-w-0 flex-col gap-2 text-sm">
      <span className="block leading-5 font-semibold">{isAr ? "نوع الوثيقة" : "Type de document"}</span>
      <FormSelect
        name="type"
        required
        locale={locale}
        ariaLabel={isAr ? "نوع الوثيقة" : "Type de document"}
        options={recordTypes}
        value={type}
        onValueChange={(value) => {
          const nextType = value as RecordType;
          setType(nextType);
          setStatus(nextType === "DRUG_TEST_RESULT" ? "" : "PENDING");
        }}
      />
    </label>
    {type !== "LAB_ANALYSIS" ? <label className="flex min-w-0 flex-col gap-2 text-sm">
      <span className="block leading-5 font-semibold">{type === "DRUG_TEST_RESULT"
        ? (isAr ? "نتيجة فحص المخدرات" : "Résultat du dépistage")
        : (isAr ? "الحالة الطبية (للأهلية فقط)" : "Aptitude (pour le certificat médical uniquement)")}</span>
      <FormSelect
        name="status"
        required
        locale={locale}
        ariaLabel={type === "DRUG_TEST_RESULT" ? (isAr ? "نتيجة فحص المخدرات" : "Résultat du dépistage") : (isAr ? "الحالة الطبية" : "Statut médical")}
        options={statusOptions}
        value={status}
        onValueChange={setStatus}
      />
    </label> : <input type="hidden" name="status" value="PENDING" />}
  </>;
}
