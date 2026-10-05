import { getTranslations } from "next-intl/server";
import { DateInput } from "@/components/ui/date-input";

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
        <select name="category" required defaultValue={defaults.category} className={inputClass}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}` as any)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.paymentMethod")}</label>
        <select name="paymentMethod" defaultValue={defaults.paymentMethod ?? ""} className={inputClass}>
          <option value="">—</option>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`paymentMethods.${m}` as any)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.payeeName")}</label>
        <input name="payeeName" defaultValue={defaults.payeeName ?? ""} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{tTeams("title")}</label>
        <select name="teamId" defaultValue={defaults.teamId ?? ""} className={inputClass}>
          <option value="">{t("clubWide")}</option>
          {options.teams.map((tm) => (
            <option key={tm.id} value={tm.id}>
              {tTeams(`categories.${tm.category}` as any)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.season")}</label>
        <select name="seasonId" required defaultValue={defaults.seasonId} className={inputClass}>
          {options.seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.budget")}</label>
        <select name="budgetId" defaultValue={defaults.budgetId ?? ""} className={inputClass}>
          <option value="">—</option>
          {options.budgets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.season.label} — {b.team ? tTeams(`categories.${b.team.category}` as any) : t("clubWide")} ({b.allocatedAmount.toLocaleString(locale)})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.relatedMatch")}</label>
        <select name="relatedMatchId" defaultValue={defaults.relatedMatchId ?? ""} className={inputClass}>
          <option value="">—</option>
          {options.matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.homeTeamName} – {m.awayTeamName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("fields.relatedTraining")}</label>
        <select name="relatedTrainingId" defaultValue={defaults.relatedTrainingId ?? ""} className={inputClass}>
          <option value="">—</option>
          {options.trainingSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {new Intl.DateTimeFormat(locale).format(s.date)}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <label className="mb-1 block text-sm font-medium">{t("fields.notes")}</label>
        <textarea name="notes" rows={3} defaultValue={defaults.notes ?? ""} className={inputClass} />
      </div>
    </>
  );
}
