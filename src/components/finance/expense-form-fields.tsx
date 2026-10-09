import { getTranslations } from "next-intl/server";
import { DateInput } from "@/components/ui/date-input";
import { localizedClubName } from "@/lib/public/locale-text";
import { StyledSelect } from "@/components/ui/styled-select";

const CATEGORIES = ["FOOD", "TRANSPORT", "LODGING", "EQUIPMENT", "MEDICAL", "ADMINISTRATION", "TRAINING", "MATCH", "TRAVEL", "OTHER"] as const;
const METHODS = ["CASH", "BANK_TRANSFER", "CARD", "OTHER"] as const;

export type ExpenseFormDefaults = {
  description: string;
  amount: number;
  date: Date;
  category: string;
  paymentMethod: string | null;
  payeeName: string | null;
  teamId: string | null;
  seasonId: string;
  budgetId: string | null;
  relatedMatchId: string | null;
  relatedTrainingId: string | null;
  notes: string | null;
};

export type ExpenseFormOptions = {
  seasons: { id: string; label: string }[];
  teams: { id: string; category: string }[];
  budgets: { id: string; allocatedAmount: number; season: { label: string }; team: { category: string } | null }[];
  matches: { id: string; homeTeamName: string; awayTeamName: string }[];
  trainingSessions: { id: string; date: Date }[];
};

const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

/**
 * The editable fields of an expense (same fields, names and constraints as the
 * create page), pre-filled from an existing DRAFT expense. Rendering only —
 * the amount/consistency/status rules are enforced by updateExpenseAction on
 * the server, never by these inputs.
 */
export async function ExpenseFormFields({ locale, defaults, options }: { locale: string; defaults: ExpenseFormDefaults; options: ExpenseFormOptions }) {
  const t = await getTranslations("finance");
  const tTeams = await getTranslations("teams");

  return (
    <>
      <div className="col-span-2">
        <label className="mb-1 block text-sm font-medium">{t("fields.description")}</label>
        <input name="description" required defaultValue={defaults.description} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.amount")}</label>
        <input name="amount" type="number" min={1} step={1} required defaultValue={defaults.amount} className={inputClass} />
      </div>
      <div>
        <DateInput
          label={t("fields.date")}
          name="date"
          required
          defaultValue={defaults.date}
          locale={locale}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.category")}</label>
        <StyledSelect name="category" defaultValue={defaults.category} options={CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}` as any) }))} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.paymentMethod")}</label>
        <StyledSelect name="paymentMethod" defaultValue={defaults.paymentMethod ?? ""} options={[{ value: "", label: "—" }, ...METHODS.map((m) => ({ value: m, label: t(`paymentMethods.${m}` as any) }))]} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.payeeName")}</label>
        <input name="payeeName" defaultValue={defaults.payeeName ?? ""} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{tTeams("title")}</label>
        <StyledSelect name="teamId" defaultValue={defaults.teamId ?? ""} options={[{ value: "", label: t("clubWide") }, ...options.teams.map((tm) => ({ value: tm.id, label: tTeams(`categories.${tm.category}` as any) }))]} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.season")}</label>
        <StyledSelect name="seasonId" defaultValue={defaults.seasonId} options={options.seasons.map((s) => ({ value: s.id, label: s.label }))} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.budget")}</label>
        <StyledSelect name="budgetId" defaultValue={defaults.budgetId ?? ""} options={[{ value: "", label: "—" }, ...options.budgets.map((b) => ({ value: b.id, label: `${b.season.label} — ${b.team ? tTeams(`categories.${b.team.category}` as any) : t("clubWide")} (${b.allocatedAmount.toLocaleString(locale)})` }))]} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.relatedMatch")}</label>
        <StyledSelect name="relatedMatchId" defaultValue={defaults.relatedMatchId ?? ""} options={[{ value: "", label: "—" }, ...options.matches.map((m) => ({ value: m.id, label: `${localizedClubName(m.homeTeamName, locale, locale === "ar" ? "الفريق" : "Club")} – ${localizedClubName(m.awayTeamName, locale, locale === "ar" ? "الفريق" : "Club")}` }))]} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.relatedTraining")}</label>
        <StyledSelect name="relatedTrainingId" defaultValue={defaults.relatedTrainingId ?? ""} options={[{ value: "", label: "—" }, ...options.trainingSessions.map((s) => ({ value: s.id, label: new Intl.DateTimeFormat(locale).format(s.date) }))]} />
      </div>
      <div className="col-span-2">
        <label className="mb-1 block text-sm font-medium">{t("fields.notes")}</label>
        <textarea name="notes" rows={3} defaultValue={defaults.notes ?? ""} className={inputClass} />
      </div>
    </>
  );
}
