/**
 * Unified Financial Theme & Color Palette for ESH Platform
 *
 * The 5 Core Financial Pillars:
 * 1. البنك (Bank Account / BNA): Blue
 * 2. الصندوق (Cash Account / Caisse): Teal / Cyan
 * 3. الإيداعات (Deposits): Emerald Green
 * 4. السحوبات (Withdrawals / Outflow): Amber / Orange
 * 5. المصاريف (Expenses / Invoices): Crimson Red
 */

export const FINANCE_COLORS = {
  // 1. Bank Account (البنك)
  bank: {
    nameAr: "البنك",
    nameFr: "Banque",
    hex: "#2563EB", // blue-600
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30",
    btn: "bg-blue-600 hover:bg-blue-700 text-white",
    fill: "#2563EB"
  },

  // 2. Cash Account / Caisse (الصندوق)
  cash: {
    nameAr: "الصندوق",
    nameFr: "Caisse",
    hex: "#0D9488", // teal-600
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
    badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30",
    btn: "bg-teal-600 hover:bg-teal-700 text-white",
    fill: "#0D9488"
  },

  // 3. Deposits (الإيداعات)
  deposits: {
    nameAr: "الإيداعات",
    nameFr: "Dépôts",
    hex: "#10B981", // emerald-500 / emerald-600
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
    btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
    fill: "#10B981"
  },

  // 4. Withdrawals (السحوبات)
  withdrawals: {
    nameAr: "السحوبات",
    nameFr: "Retraits",
    hex: "#F59E0B", // amber-500 / amber-600
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30",
    btn: "bg-amber-600 hover:bg-amber-700 text-white",
    fill: "#F59E0B"
  },

  // 5. Expenses / Invoices (المصاريف)
  expenses: {
    nameAr: "المصاريف",
    nameFr: "Dépenses",
    hex: "#DC2626", // red-600
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30",
    btn: "bg-red-600 hover:bg-red-700 text-white",
    fill: "#DC2626"
  }
} as const;
