"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FileCheck, Send, ClipboardList, ShieldCheck, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { sortDashboardLinksByNavOrder } from "@/lib/dashboard-navigation";

interface DocumentsNavTabsProps {
  locale: string;
  canViewDocuments?: boolean;
  canViewContracts?: boolean;
  canViewInsurance?: boolean;
  canViewCorrespondence?: boolean;
  canViewMeetings?: boolean;
  canManageTemplates?: boolean;
  canViewTemplates?: boolean;
  canViewReports?: boolean;
}

export function DocumentsNavTabs({
  locale,
  canViewDocuments = false,
  canViewContracts = false,
  canViewInsurance = false,
  canViewCorrespondence = false,
  canViewMeetings = false,
  canViewReports = false
}: DocumentsNavTabsProps) {
  const pathname = usePathname();

  const isAr = locale === "ar";

  const tabs = [
    {
      href: `/${locale}/dashboard/documents`,
      label: isAr ? "أرشيف الوثائق" : "Archives des documents",
      icon: FileText,
      visible: canViewDocuments,
      exact: true
    },
    {
      href: `/${locale}/dashboard/contracts`,
      label: isAr ? "العقود والاتفاقيات" : "Contrats et conventions",
      icon: FileCheck,
      visible: canViewContracts,
      exact: false
    },
    {
      href: `/${locale}/dashboard/correspondence`,
      label: isAr ? "المراسلات والطعون" : "Correspondances et recours",
      icon: Send,
      visible: canViewCorrespondence,
      exact: false
    },
    {
      href: `/${locale}/dashboard/meeting-minutes`,
      label: isAr ? "محاضر الاجتماعات" : "Procès-verbaux",
      icon: ClipboardList,
      visible: canViewMeetings,
      exact: false
    },
    {
      href: `/${locale}/dashboard/reports`,
      label: isAr ? "التقارير" : "Rapports",
      icon: BarChart3,
      visible: canViewReports,
      exact: false
    },
    {
      href: `/${locale}/dashboard/insurance`,
      label: isAr ? "التأمين الرياضي" : "Assurance Sportive",
      icon: ShieldCheck,
      visible: canViewInsurance,
      exact: false
    }
  ].filter((t) => t.visible);
  const orderedTabs = sortDashboardLinksByNavOrder("governance", tabs);

  return (
    <div className="mb-6 border-b border-border/80">
        <nav className="-mb-px flex flex-wrap gap-2 sm:gap-4" aria-label={isAr ? "أقسام الوثائق" : "Sections documentaires"}>
        {orderedTabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group inline-flex items-center gap-2 border-b-2 py-3 px-3 text-xs sm:text-sm font-semibold transition-all",
                isActive
                  ? "border-club-primary text-club-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-club-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
