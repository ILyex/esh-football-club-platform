"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Receipt, Search, CheckCircle2, Paperclip, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { OfficialVoucherModal } from "@/components/finance/official-voucher-modal";

export type ClubExpenseItem = {
  id: string;
  referenceNumber: string;
  amount: number;
  date: string; // ISO string with date & time
  timestamp: number;
  description: string;
  category: string;
  payeeName?: string | null;
  teamName?: string | null;
  documentId?: string | null;
  documentName?: string | null;
  generatedDocId?: string | null;
  isDebt?: boolean;
  isSettled?: boolean;
};

interface ClubExpensesTableProps {
  expenses: ClubExpenseItem[];
  locale?: string;
}

const CATEGORY_NAMES_AR: Record<string, string> = {
  FOOD: "إطعام وتغذية",
  TRANSPORT: "نقل ومواصلات",
  LODGING: "إيواء وفندقة",
  EQUIPMENT: "عتاد وألبسة رياضية",
  MEDICAL: "مصاريف طبية وعلاج",
  ADMINISTRATION: "مصاريف إدارية",
  TRAINING: "تربصات وتدريب",
  MATCH: "تنظيم المباريات",
  TRAVEL: "تنقل وسفريات",
  OTHER: "مصاريف أخرى"
};

const CATEGORY_NAMES_FR: Record<string, string> = {
  FOOD: "Restauration",
  TRANSPORT: "Transport",
  LODGING: "Hébergement",
  EQUIPMENT: "Équipements",
  MEDICAL: "Frais Médicaux",
  ADMINISTRATION: "Administration",
  TRAINING: "Entraînement",
  MATCH: "Organisation Matchs",
  TRAVEL: "Déplacements",
  OTHER: "Autres"
};

export function ClubExpensesTable({ expenses, locale = "ar" }: ClubExpensesTableProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 5;

  const isAr = locale === "ar";
  const currencySuffix = isAr ? " دج" : " DZD";
  const formatMoney = (amount: number) => amount.toLocaleString(locale) + currencySuffix;

  const categoryNames = isAr ? CATEGORY_NAMES_AR : CATEGORY_NAMES_FR;

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return expenses.filter((e) => {
      if (selectedCategory !== "ALL" && e.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        e.referenceNumber.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.payeeName && e.payeeName.toLowerCase().includes(q)) ||
        (e.teamName && e.teamName.toLowerCase().includes(q))
      );
    });
  }, [expenses, selectedCategory, searchQuery]);

  // Reset page when filter changes
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredExpenses.length / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const displayedExpenses = filteredExpenses.slice(startIndex, startIndex + pageSize);

  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [filteredExpenses]);

  // Unique categories in the current expenses dataset
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) {
      if (e.category) set.add(e.category);
    }
    return Array.from(set);
  }, [expenses]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm space-y-0">
      {/* Table Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-5 w-5 text-red-600 dark:text-red-400" />
            <span>{isAr ? "سجل مصروفات النادي" : "Registre des Dépenses du Club"}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAr
              ? "سجل توثيق شامل لكافة مصاريف النادي والفواتير المعتمدة"
              : "Historique centralisé des dépenses et factures officielles"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1 text-xs">
            <span className="text-muted-foreground me-1.5">{isAr ? "إجمالي المصاريف:" : "Total:"}</span>
            <span className="font-mono font-bold text-red-700 dark:text-red-400">
              {formatMoney(totalFilteredAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Search and Category Quick Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/60 bg-muted/10 px-5 py-3">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => handleCategoryChange("ALL")}
            className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
              selectedCategory === "ALL"
                ? "bg-foreground text-background shadow-xs font-bold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>{isAr ? "كافة المصاريف" : "Toutes"}</span>
            <span className="ms-1.5 text-[10px] opacity-75">({expenses.length})</span>
          </button>

          {uniqueCategories.map((cat) => {
            const count = expenses.filter((e) => e.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  isSelected
                    ? "bg-red-600 text-white shadow-xs font-bold"
                    : "text-muted-foreground hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400"
                }`}
              >
                <span>{categoryNames[cat] || cat}</span>
                <span className="ms-1 text-[10px] opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={isAr ? "بحث بالمرجع، البيان، أو المستفيد..." : "Rechercher..."}
            className="w-full rounded-lg border border-border bg-background py-1.5 ps-8 pe-3 text-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Unified Expenses Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs">
          <thead className="border-b border-border/60 bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{isAr ? "المرجع والتاريخ والوقت" : "Réf, Date & Heure"}</th>
              <th className="px-4 py-3 text-start">{isAr ? "البيان / المستفيد" : "Description / Bénéficiaire"}</th>
              <th className="px-4 py-3 text-start">{isAr ? "الفئة والجهة" : "Catégorie / Équipe"}</th>
              <th className="px-4 py-3 text-start">{isAr ? "المبلغ" : "Montant"}</th>
              <th className="px-4 py-3 text-start">{isAr ? "حالة السداد" : "Règlement"}</th>
              <th className="px-4 py-3 text-start">{isAr ? "معاينة الفاتورة" : "Facture"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {displayedExpenses.map((e) => (
              <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                {/* Reference, Date & Time */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-mono font-bold text-foreground">
                    {e.referenceNumber}
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <span className="font-medium">
                      {new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(new Date(e.date))}
                    </span>
                    <span className="opacity-40">•</span>
                    <span className="font-mono text-zinc-600 dark:text-zinc-400">
                      {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(e.date))}
                    </span>
                  </p>
                </td>

                {/* Description & Payee */}
                <td className="px-4 py-3 max-w-xs">
                  <p className="font-medium text-foreground truncate">{e.description}</p>
                  {e.payeeName ? (
                    <p className="text-[11px] text-muted-foreground truncate">
                      <span className="opacity-70">{isAr ? "المستفيد: " : "Bénéficiaire: "}</span>
                      <strong className="text-foreground/80 font-normal">{e.payeeName}</strong>
                    </p>
                  ) : null}
                </td>

                {/* Category & Team */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-block rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-400">
                    {categoryNames[e.category] || e.category}
                  </span>
                  {e.teamName && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{e.teamName}</p>
                  )}
                </td>

                {/* Amount */}
                <td className="px-4 py-3 font-mono font-bold text-sm text-foreground whitespace-nowrap">
                  <span className="text-red-600 dark:text-red-400">
                    {formatMoney(e.amount)}
                  </span>
                </td>

                {/* Settlement Status & Debt Action */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {e.isDebt ? (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                        {isAr ? "دين معلق" : "Dette"}
                      </span>
                      <Link href={`/${locale}/dashboard/finance/expenses/${e.id}`} className="text-[10px] font-semibold text-primary underline underline-offset-2">
                        {isAr ? "تسجيل السداد" : "Enregistrer le paiement"}
                      </Link>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{isAr ? "مسددة" : "Réglée"}</span>
                    </span>
                  )}
                </td>

                {/* Official Voucher Preview Modal & Document Link (No download statement button) */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <OfficialVoucherModal
                      type="EXPENSE"
                      referenceNumber={e.referenceNumber}
                      amount={e.amount}
                      date={e.date}
                      beneficiaryOrSource={e.payeeName || e.teamName || e.description}
                      purpose={e.description}
                      documentId={e.documentId}
                      documentName={e.documentName}
                      locale={locale}
                      buttonLabel={isAr ? "معاينة الفاتورة" : "Voir la facture"}
                    />

                    {e.documentId && (
                      <a
                        href={`/api/documents/${e.documentId}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title={e.documentName || (isAr ? "تحميل الفاتورة المرفقة" : "Télécharger justificatif")}
                      >
                        <Paperclip className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filteredExpenses.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-muted-foreground/40 mb-1.5" />
                  <p className="text-xs">
                    {isAr
                      ? "لا توجد مصاريف مطابقة للبحث أو الفئة المختارة."
                      : "Aucune dépense trouvée."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer (5 items per view to avoid crowding) */}
      {filteredExpenses.length > pageSize && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 bg-muted/15 px-5 py-3 text-xs">
          <div className="text-muted-foreground">
            {isAr
              ? `عرض ${startIndex + 1} إلى ${Math.min(startIndex + pageSize, filteredExpenses.length)} من أصل ${filteredExpenses.length} عملية`
              : `Affichage de ${startIndex + 1} à ${Math.min(startIndex + pageSize, filteredExpenses.length)} sur ${filteredExpenses.length} dépenses`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isAr ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              <span>{isAr ? "السابق" : "Précédent"}</span>
            </button>

            <span className="font-mono text-muted-foreground px-2">
              {safeCurrentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>{isAr ? "التالي" : "Suivant"}</span>
              {isAr ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
