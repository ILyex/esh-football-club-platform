"use client";

import { useState } from "react";
import Link from "next/link";
import { User, Users, Briefcase, Save, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { FormSelect } from "@/components/ui/form-select";

interface OptionItem {
  id: string;
  name: string;
  subtitle?: string;
  categoryName?: string;
}

interface ContractFormProps {
  locale: string;
  players: OptionItem[];
  staff: OptionItem[];
  action: (formData: FormData) => Promise<void>;
  types: readonly string[];
  statuses: readonly string[];
  translations: {
    title: string;
    addContract: string;
    typeLabel: string;
    statusLabel: string;
    playerLabel: string;
    staffLabel: string;
    startDateLabel: string;
    endDateLabel: string;
    notesLabel: string;
    save: string;
    cancel: string;
    none: string;
    typesMap: Record<string, string>;
    statusesMap: Record<string, string>;
  };
}

export function ContractForm({
  locale,
  players,
  staff,
  action,
  types,
  statuses,
  translations: t
}: ContractFormProps) {
  const isAr = locale === "ar";
  const [subjectType, setSubjectType] = useState<"PLAYER" | "STAFF">("PLAYER");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [contractType, setContractType] = useState(types[0] || "PROFESSIONAL");
  const [status, setStatus] = useState("PENDING");
  const [submitting, setSubmitting] = useState(false);

  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const handleSubjectTypeChange = (type: "PLAYER" | "STAFF") => {
    setSubjectType(type);
    if (type === "PLAYER") {
      setSelectedStaffId("");
      if (contractType === "STAFF") {
        setContractType("PROFESSIONAL");
      }
    } else {
      setSelectedPlayerId("");
      setContractType("STAFF");
    }
  };

  return (
    <form
      action={async (formData) => {
        setSubmitting(true);
        try {
          await action(formData);
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-6"
    >
      {/* ── Section 1: Contracting Party Selection (الطرف المتعاقد) ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
        <div className="border-b border-border/80 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-club-primary/10 text-club-primary text-xs font-bold">
              1
            </span>
            <h2 className="text-base font-bold text-foreground">
              {isAr ? "الطرف المتعاقد (لاعب أو عضو طاقم)" : "Partie contractante (Joueur ou Staff)"}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {isAr ? "عقد فردي حصري" : "Contrat individuel exclusif"}
          </span>
        </div>

        {/* Toggle Pills */}
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button
            type="button"
            onClick={() => handleSubjectTypeChange("PLAYER")}
            className={`flex items-center justify-center gap-2.5 rounded-xl border p-3.5 text-sm font-bold transition-all cursor-pointer ${
              subjectType === "PLAYER"
                ? "border-club-primary bg-club-primary/10 text-club-primary shadow-xs ring-1 ring-club-primary/30"
                : "border-border bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <User className="h-4 w-4" />
            <span>{isAr ? "لاعب رياضي" : "Joueur"}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-background border border-border/70 text-foreground">
              {players.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSubjectTypeChange("STAFF")}
            className={`flex items-center justify-center gap-2.5 rounded-xl border p-3.5 text-sm font-bold transition-all cursor-pointer ${
              subjectType === "STAFF"
                ? "border-club-primary bg-club-primary/10 text-club-primary shadow-xs ring-1 ring-club-primary/30"
                : "border-border bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>{isAr ? "عضو طاقم فني / إداري" : "Membre du Staff"}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-background border border-border/70 text-foreground">
              {staff.length}
            </span>
          </button>
        </div>

        {/* Subject Select Dropdown */}
        {subjectType === "PLAYER" ? (
          <div className="mx-auto w-full max-w-2xl">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t.playerLabel} <span className="text-red-500">*</span>
            </label>
            <FormSelect
              name="playerId"
              required
              locale={locale}
              ariaLabel={t.playerLabel}
              placeholder={isAr ? "— اختر اللاعب المعني بالعقد —" : "— Sélectionner le joueur —"}
              defaultValue={selectedPlayerId}
              onValueChange={setSelectedPlayerId}
              options={players.map((p) => ({
                value: p.id,
                label: `${p.name} ${p.categoryName ? `(${p.categoryName})` : ""}`
              }))}
            />
            {/* hidden empty staff input */}
            <input type="hidden" name="staffId" value="" />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t.staffLabel} <span className="text-red-500">*</span>
            </label>
            <FormSelect
              name="staffId"
              required
              locale={locale}
              ariaLabel={t.staffLabel}
              placeholder={isAr ? "— اختر عضو الطاقم المعني بالعقد —" : "— Sélectionner le membre du staff —"}
              defaultValue={selectedStaffId}
              onValueChange={setSelectedStaffId}
              options={staff.map((s) => ({
                value: s.id,
                label: `${s.name} ${s.subtitle ? `(${s.subtitle})` : ""}`
              }))}
            />
            {/* hidden empty player input */}
            <input type="hidden" name="playerId" value="" />
          </div>
        )}
      </div>

      {/* ── Section 2: Contract Terms & Status (بنود ونوع العقد) ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
        <div className="border-b border-border/80 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-club-primary/10 text-club-primary text-xs font-bold">
              2
            </span>
            <h2 className="text-base font-bold text-foreground">
              {isAr ? "تفاصيل وصلاحية العقد" : "Détails & Validité du contrat"}
            </h2>
          </div>
          <Briefcase className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t.typeLabel} <span className="text-red-500">*</span>
            </label>
            <FormSelect
              name="type"
              required
              locale={locale}
              ariaLabel={t.typeLabel}
              defaultValue={contractType}
              onValueChange={setContractType}
              options={types.map((ty) => ({ value: ty, label: t.typesMap[ty] || ty }))}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t.statusLabel} <span className="text-red-500">*</span>
            </label>
            <FormSelect
              name="status"
              required
              locale={locale}
              ariaLabel={t.statusLabel}
              defaultValue={status}
              onValueChange={setStatus}
              options={statuses.map((s) => ({ value: s, label: t.statusesMap[s] || s }))}
            />
          </div>

          <div className="mx-auto w-full max-w-4xl">
            <DateInput
              label={t.startDateLabel}
              name="startDate"
              required
              locale={locale}
            />
          </div>

          <div>
            <DateInput
              label={t.endDateLabel}
              name="endDate"
              required
              locale={locale}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t.notesLabel}
          </label>
          <textarea
            name="notes"
            rows={3}
            placeholder={
              isAr
                ? "أي بنود إضافية، المكافآت المتفق عليها، الشروط الجزائية، أو الملاحظات القانونية..."
                : "Clauses particulières, primes négociées, remarques juridiques..."
            }
            className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-club-primary focus:ring-1 focus:ring-club-primary"
          />
        </div>
      </div>

      {/* ── Action Buttons Row ── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link href={`/${locale}/dashboard/contracts`}>
          <Button type="button" variant="outline" className="px-5">
            {t.cancel}
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2 px-6 shadow-xs"
        >
          <Save className="h-4 w-4" />
          <span>{submitting ? (isAr ? "جارٍ الحفظ..." : "Enregistrement...") : t.save}</span>
        </Button>
      </div>
    </form>
  );
}
