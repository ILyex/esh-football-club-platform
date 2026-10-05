"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Receipt, Paperclip, Search, CheckCircle2, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { OfficialVoucherModal } from "@/components/finance/official-voucher-modal";
import { EditFinancialOperationModal } from "@/components/finance/edit-financial-operation-modal";
import { DeleteFinancialOperationDialog } from "@/components/finance/delete-financial-operation-dialog";

export type UnifiedFinancialOperation = {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "EXPENSE";
  referenceNumber: string;
  date: string;
  timestamp: number;
  amount: number;
  description: string;
  subtext: string;
  accountName?: string;
  treasuryAccountId?: string;
  beneficiary?: string;
  nationalIdNumber?: string;
  documentId?: string | null;
  documentName?: string | null;
};

interface FinancialOperationsTableProps {
  operations: UnifiedFinancialOperation[];
  locale?: string;
  isProgrammer?: boolean;
  accounts?: { id: string; name: string }[];
}

export function FinancialOperationsTable({
  operations,
  locale = "ar",
  isProgrammer = false,
  accounts = []
}: FinancialOperationsTableProps) {
  const [filterType, setFilterType] = useState<"ALL" | "DEPOSIT" | "WITHDRAWAL" | "EXPENSE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 5;

  const currencySuffix = locale === "ar" ? " دج" : " DZD";
  const formatMoney = (amount: number) => amount.toLocaleString(locale) + currencySuffix;

  // Counts for tabs
  const counts = useMemo(() => {
    let deposit = 0;
    let withdrawal = 0;
    let expense = 0;
    for (const op of operations) {
      if (op.type === "DEPOSIT") deposit++;
      else if (op.type === "WITHDRAWAL") withdrawal++;
      else if (op.type === "EXPENSE") expense++;
    }
    return { all: operations.length, deposit, withdrawal, expense };
  }, [operations]);

  // Filtered operations based on type and search query
  const filteredOperations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return operations.filter((op) => {
      if (filterType !== "ALL" && op.type !== filterType) return false;
      if (!query) return true;
      return (
        op.referenceNumber.toLowerCase().includes(query) ||
        op.description.toLowerCase().includes(query) ||
        op.subtext.toLowerCase().includes(query)
      );
    });
  }, [operations, filterType, searchQuery]);

  const handleFilterChange = (type: "ALL" | "DEPOSIT" | "WITHDRAWAL" | "EXPENSE") => {
    setFilterType(type);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredOperations.length / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const displayedOperations = filteredOperations.slice(startIndex, startIndex + pageSize);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm space-y-0">
      {/* Table Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-primary" />
            <span>{locale === "ar" ? "سجلات العمليات المالية" : "Journal des Opérations Financières"}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === "ar"
              ? "سجل موحد وشامل يجمع حركات الإيداع البنكي، السحوبات النقدية، وعمليات الصرف المبررة بالفواتير"
              : "Historique centralisé des dépôts, retraits de caisse et dépenses justifiées"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/dashboard/finance/treasury`}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {locale === "ar" ? "الخزينة ←" : "Trésorerie ←"}
          </Link>
          <span className="text-border">|</span>
          <Link
            href={`/${locale}/dashboard/finance/expenses`}
            className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
          >
            {locale === "ar" ? "سجل مصروفات النادي ←" : "Dépenses ←"}
          </Link>
        </div>
      </div>

      {/* Filter Tabs and Quick Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/60 bg-muted/10 px-5 py-3">
        {/* Type Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => handleFilterChange("ALL")}
            className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
              filterType === "ALL"
                ? "bg-foreground text-background shadow-xs font-bold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>{locale === "ar" ? "كافة العمليات" : "Toutes"}</span>
            <span className="ms-1.5 text-[10px] opacity-75">({counts.all})</span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange("DEPOSIT")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-all ${
              filterType === "DEPOSIT"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            <ArrowDownLeft className="h-3 w-3" />
            <span>{locale === "ar" ? "إيداعات" : "Dépôts"}</span>
            <span className="text-[10px] opacity-80">({counts.deposit})</span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange("WITHDRAWAL")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-all ${
              filterType === "WITHDRAWAL"
                ? "bg-amber-600 text-white shadow-xs font-bold"
                : "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            <ArrowUpRight className="h-3 w-3" />
            <span>{locale === "ar" ? "سحوبات" : "Retraits"}</span>
            <span className="text-[10px] opacity-80">({counts.withdrawal})</span>
          </button>

          <button
            type="button"
            onClick={() => handleFilterChange("EXPENSE")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-all ${
              filterType === "EXPENSE"
                ? "bg-red-600 text-white shadow-xs font-bold"
                : "text-red-700 dark:text-red-400 hover:bg-red-500/10"
            }`}
          >
            <Receipt className="h-3 w-3" />
            <span>{locale === "ar" ? "المصاريف" : "Dépenses"}</span>
            <span className="text-[10px] opacity-80">({counts.expense})</span>
          </button>
        </div>

        {/* Quick Search Input */}
        <div className="relative min-w-[200px]">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={locale === "ar" ? "بحث بالمرجع أو البيان..." : "Rechercher..."}
            className="w-full rounded-lg border border-border bg-background py-1.5 ps-8 pe-3 text-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Unified Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs">
          <thead className="border-b border-border/60 bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "المرجع والتاريخ والوقت" : "Réf, Date & Heure"}</th>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "طبيعة العملية" : "Nature"}</th>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "البيان / المستفيد" : "Description"}</th>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "المبلغ" : "Montant"}</th>
              <th className="px-4 py-3 text-start">{locale === "ar" ? "المستند / الوثيقة" : "Document"}</th>
              {isProgrammer && (
                <th className="px-4 py-3 text-start">{locale === "ar" ? "تعديل / حذف" : "Modifier / Supprimer"}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {displayedOperations.map((op) => {
              const isDeposit = op.type === "DEPOSIT";
              const isWithdrawal = op.type === "WITHDRAWAL";
              const isExpense = op.type === "EXPENSE";

              return (
                <tr key={op.id} className="hover:bg-muted/20 transition-colors">
                  {/* Reference & Date & Time */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-mono font-bold text-foreground">
                      {op.referenceNumber}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span className="font-medium">
                        {new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(new Date(op.date))}
                      </span>
                      <span className="opacity-40">•</span>
                      <span className="font-mono text-zinc-600 dark:text-zinc-400">
                        {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(op.date))}
                      </span>
                    </p>
                  </td>

                  {/* Operation Type Badge */}
                  <td className="px-4 py-3">
                    {isDeposit && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <ArrowDownLeft className="h-3 w-3" />
                        <span>{locale === "ar" ? "إيداع" : "Dépôt"}</span>
                      </span>
                    )}
                    {isWithdrawal && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        <ArrowUpRight className="h-3 w-3" />
                        <span>{locale === "ar" ? "سحب" : "Retrait"}</span>
                      </span>
                    )}
                    {isExpense && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                        <Receipt className="h-3 w-3" />
                        <span>{locale === "ar" ? "مصاريف" : "Dépense"}</span>
                      </span>
                    )}
                  </td>

                  {/* Description & Beneficiary */}
                  <td className="px-4 py-3 max-w-xs truncate">
                    <p className="font-medium text-foreground truncate">{op.description}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{op.subtext}</p>
                  </td>

                  {/* Amount with Direction Suffix */}
                  <td className="px-4 py-3 font-mono font-bold text-sm">
                    {isDeposit && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{formatMoney(op.amount)}
                      </span>
                    )}
                    {isWithdrawal && (
                      <span className="text-amber-600 dark:text-amber-400">
                        -{formatMoney(op.amount)}
                      </span>
                    )}
                    {isExpense && (
                      <span className="text-red-600 dark:text-red-400">
                        -{formatMoney(op.amount)}
                      </span>
                    )}
                  </td>

                  {/* Document / Voucher */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <OfficialVoucherModal
                        type={op.type}
                        referenceNumber={op.referenceNumber}
                        amount={op.amount}
                        date={op.date}
                        beneficiaryOrSource={op.beneficiary || (isExpense ? (op.subtext || op.description) : op.description)}
                        nationalIdNumber={op.nationalIdNumber}
                        purpose={op.description}
                        accountName={op.accountName}
                        documentId={op.documentId}
                        documentName={op.documentName}
                        locale={locale}
                        buttonLabel={
                          locale === "ar"
                            ? isExpense
                              ? "معاينة الفاتورة"
                              : isDeposit
                                ? "معاينة وصل الإيداع"
                                : "معاينة وصل السحب"
                            : undefined
                        }
                      />
                    </div>
                  </td>

                  {/* Programmer Actions (Edit & Delete) */}
                  {isProgrammer && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <EditFinancialOperationModal
                          operation={op}
                          locale={locale}
                          accounts={accounts}
                        />
                        <DeleteFinancialOperationDialog
                          operation={op}
                          locale={locale}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {filteredOperations.length === 0 && (
              <tr>
                <td colSpan={isProgrammer ? 6 : 5} className="py-10 text-center text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-muted-foreground/40 mb-1.5" />
                  <p>
                    {locale === "ar"
                      ? "لا توجد عمليات مالية مطابقة للبحث أو التصفية المختارة."
                      : "Aucune opération financière trouvée."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer (5 items per view to avoid crowding) */}
      {filteredOperations.length > pageSize && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 bg-muted/15 px-5 py-3 text-xs">
          <div className="text-muted-foreground">
            {locale === "ar"
              ? `عرض ${startIndex + 1} إلى ${Math.min(startIndex + pageSize, filteredOperations.length)} من أصل ${filteredOperations.length} عملية`
              : `Affichage de ${startIndex + 1} à ${Math.min(startIndex + pageSize, filteredOperations.length)} sur ${filteredOperations.length} opérations`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {locale === "ar" ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              <span>{locale === "ar" ? "السابق" : "Précédent"}</span>
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
              <span>{locale === "ar" ? "التالي" : "Suivant"}</span>
              {locale === "ar" ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
