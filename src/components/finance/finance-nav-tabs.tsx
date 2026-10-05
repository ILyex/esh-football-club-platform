"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { isDashboardNavHrefActive, sortDashboardLinksByNavOrder } from "@/lib/dashboard-navigation";
import { FINANCE_COLORS } from "@/lib/finance/colors";
import {
  BarChart3,
  Landmark,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt
} from "lucide-react";

export function FinanceNavTabs({ locale }: { locale: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("finance");

  const tabs = [
    {
      href: `/${locale}/dashboard/finance`,
      label: locale === "ar" ? "نظرة عامة" : "Vue d'ensemble",
      icon: BarChart3,
      exact: true
    },
    {
      href: `/${locale}/dashboard/finance/treasury?view=BANK`,
      label: locale === "ar" ? "البنك" : "Banque (BNA)",
      icon: Landmark,
      color: FINANCE_COLORS.bank.text,
      activeBorder: FINANCE_COLORS.bank.border,
      exact: false
    },
    {
      href: `/${locale}/dashboard/finance/treasury?view=CASH`,
      label: locale === "ar" ? "الصندوق" : "Caisse",
      icon: Wallet,
      color: FINANCE_COLORS.cash.text,
      activeBorder: FINANCE_COLORS.cash.border,
      exact: false
    },
    {
      href: `/${locale}/dashboard/finance/treasury?view=DEPOSITS`,
      label: t("deposits"),
      icon: ArrowDownLeft,
      color: FINANCE_COLORS.deposits.text,
      activeBorder: FINANCE_COLORS.deposits.border,
      exact: false
    },
    {
      href: `/${locale}/dashboard/finance/treasury?view=WITHDRAWALS`,
      label: locale === "ar" ? "السحوبات" : "Retraits",
      icon: ArrowUpRight,
      color: FINANCE_COLORS.withdrawals.text,
      activeBorder: FINANCE_COLORS.withdrawals.border,
      exact: false
    },
    {
      href: `/${locale}/dashboard/finance/expenses`,
      label: locale === "ar" ? "المصاريف" : "Dépenses",
      icon: Receipt,
      color: FINANCE_COLORS.expenses.text,
      activeBorder: FINANCE_COLORS.expenses.border,
      exact: false
    }
  ];
  const orderedTabs = sortDashboardLinksByNavOrder("finance", tabs);

  return (
    <div className="mb-6 flex overflow-x-auto border-b border-border/80 pb-px">
      <nav className="flex space-x-1 rtl:space-x-reverse" aria-label="Finance Navigation">
        {orderedTabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : isDashboardNavHrefActive(tab.href, pathname, searchParams);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? `${tab.activeBorder ?? "border-club-primary"} font-semibold ${tab.color ?? "text-club-primary"}`
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? tab.color ?? "text-club-primary" : "text-muted-foreground"}`} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
