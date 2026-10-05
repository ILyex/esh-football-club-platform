import { z } from "zod";

// Money is always a positive whole-DZD integer — see the engineering report
// for why minor-unit subdivision was deliberately not used. This single
// schema is reused everywhere an amount is accepted, so "amount must be
// positive" is enforced in exactly one place.
const positiveAmount = z.coerce.number().int().positive();

export const budgetSchema = z.object({
  seasonId: z.string().min(1),
  teamId: z.string().optional().or(z.literal("")), // "" = club-level budget
  category: z.enum(["FOOD", "TRANSPORT", "LODGING", "EQUIPMENT", "MEDICAL", "ADMINISTRATION", "TRAINING", "MATCH", "TRAVEL", "OTHER"]).optional().or(z.literal("")),
  allocatedAmount: positiveAmount,
  status: z.enum(["ACTIVE", "CLOSED"]).default("ACTIVE"),
  notes: z.string().max(2000).optional()
});
export type BudgetInput = z.infer<typeof budgetSchema>;

export const expenseSchema = z.object({
  amount: positiveAmount,
  category: z.enum(["FOOD", "TRANSPORT", "LODGING", "EQUIPMENT", "MEDICAL", "ADMINISTRATION", "TRAINING", "MATCH", "TRAVEL", "OTHER"]),
  date: z.coerce.date(),
  description: z.string().min(1).max(500),
  payeeName: z.string().max(160).optional(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "OTHER"]).optional().or(z.literal("")),
  teamId: z.string().optional().or(z.literal("")),
  seasonId: z.string().min(1),
  budgetId: z.string().optional().or(z.literal("")),
  relatedMatchId: z.string().optional().or(z.literal("")),
  relatedTrainingId: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional()
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const treasuryAccountSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(["CASH", "BANK", "OTHER"]).default("CASH"),
  // DZD is the only currency the platform handles (whole-DZD integer money —
  // see positiveAmount above); a free-text currency would let an account's
  // ledger diverge from the DZD amounts every expense/movement is validated as.
  currency: z.literal("DZD").default("DZD"),
  openingBalance: z.coerce.number().int().min(0).default(0),
  notes: z.string().max(2000).optional()
});
export type TreasuryAccountInput = z.infer<typeof treasuryAccountSchema>;

export const treasuryMovementSchema = z.object({
  treasuryAccountId: z.string().min(1),
  amount: positiveAmount,
  transactionDate: z.coerce.date(),
  description: z.string().max(500).optional(),
  relatedExpenseId: z.string().optional().or(z.literal("")),
  idempotencyKey: z.string().min(1)
});
export type TreasuryMovementInput = z.infer<typeof treasuryMovementSchema>;
