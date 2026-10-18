import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { SafeImage } from "@/components/shared/safe-image";
import { getSessionOrThrow, hasPermission } from "@/lib/permissions";
import { getCurrentTeamId } from "@/lib/team-context";
import {
  FinancialHealthChart,
  TreasuryTrendChart,
  ExpenseDistributionDonut,
  type MonthlyTrendPoint,
  type ExpenseSlice
} from "@/components/dashboard/dashboard-charts";
import { DashboardEventsCarousel } from "@/components/dashboard/dashboard-events-carousel";
import { findOpponentLogo, getOpponentsMap } from "@/lib/opponents";
import { PlayersAndEquipmentCarousel } from "@/components/dashboard/players-and-equipment-carousel";
import {
  Trophy,
  Calendar,
  Users,
  Wallet,
  Receipt,
  FileText,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  ChevronLeft,
  Clock,
  Shield,
  Layers,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Megaphone
} from "lucide-react";
import { calculateClubDebtSummary } from "@/lib/finance/debt-service";
import { getDashboardFinancialTrend } from "@/lib/dashboard/financial-trend";

const getCachedDebtSummary = unstable_cache(
  calculateClubDebtSummary,
  ["dashboard-club-debt-summary-v1"],
  { revalidate: 30, tags: ["dashboard-financial-trend"] }
);

export default async function DashboardHomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = locale === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  const [user, t, tQuick, tInsights, tTeams, tFinance, teamId] = await Promise.all([
    getSessionOrThrow(),
    getTranslations("dashboard.stats"),
    getTranslations("dashboard.quickActions"),
    getTranslations("insights"),
    getTranslations("teams"),
    getTranslations("finance"),
    getCurrentTeamId()
  ]);
  const teamWhere = teamId ? { teamId } : {};

  const canViewFinance = hasPermission(user, "finance.view");
  // Keep this shortcut aligned with the tactics section's actual access rule.
  const canViewTacticsCard = hasPermission(user, "training.view");
  const canViewDocs = hasPermission(user, "documents.view");
  const canViewMeetings = hasPermission(user, "meetings.view");

  // Date for 12 months trend (allows client to filter 1m, 3m, 6m, 1y)
  const oneYearAgo = new Date();
  oneYearAgo.setMonth(oneYearAgo.getMonth() - 11);
  oneYearAgo.setDate(1);
  oneYearAgo.setHours(0, 0, 0, 0);

  const debtSummaryPromise = canViewFinance ? getCachedDebtSummary() : null;

  const [
    debtSummaryResult,
    opponentLogos,
    activePlayers,
    activeStaff,
    upcomingMatches,
    upcomingTrainings,
    recentMeetings,
    postedExpensesAgg,
    budgetTotals,
    tacticalPlansCount,
    monthlyTransactionTotals,
    expenseCategoriesGrouped,
    recentTransactions,
    recentExpenses,
    playersByPosition,
    inventoryStats,
    teamsWithPlayers,
    dashboardBranding
  ] = await Promise.all([
    debtSummaryPromise,
    getOpponentsMap(),
    db.player.count({ where: { ...teamWhere, status: "ACTIVE" } }),
    db.staff.count({ where: { ...teamWhere, status: "ACTIVE" } }),
    db.match.findMany({
      where: { ...teamWhere, status: "SCHEDULED", matchDate: { gte: new Date() } },
      take: 4,
      orderBy: { matchDate: "asc" },
      select: {
        id: true,
        matchDate: true,
        homeTeamName: true,
        awayTeamName: true,
        isHomeFixture: true,
        competition: { select: { name: true } }
      }
    }),
    db.trainingSession.findMany({
      where: { ...teamWhere, date: { gte: new Date() } },
      take: 4,
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        startTime: true,
        location: true,
        team: { select: { category: true } }
      }
    }),
    canViewMeetings || canViewDocs
      ? db.meetingMinute.findMany({
          take: 4,
          orderBy: { date: "desc" }
        })
      : Promise.resolve([]),
    canViewFinance ? db.expense.aggregate({ where: { status: "POSTED" }, _sum: { amount: true } }) : Promise.resolve({ _sum: { amount: 0 } }),
    canViewFinance ? db.budget.aggregate({ where: { status: "ACTIVE" }, _sum: { allocatedAmount: true } }) : Promise.resolve({ _sum: { allocatedAmount: 0 } }),
    canViewTacticsCard ? db.tacticalPlan.count({ where: { creatorId: user.id } }) : Promise.resolve(0),
    canViewFinance ? getDashboardFinancialTrend(oneYearAgo) : Promise.resolve([]),
    canViewFinance
      ? db.expense.groupBy({
          by: ["category"],
          where: { status: "POSTED" },
          _sum: { amount: true }
        })
      : Promise.resolve([]),
    canViewFinance
      ? db.treasuryTransaction.findMany({
          take: 4,
          orderBy: { createdAt: "desc" },
          include: { treasuryAccount: true, relatedExpense: true }
        })
      : Promise.resolve([]),
    canViewFinance
      ? db.expense.findMany({
          where: { status: "POSTED" },
          take: 4,
          orderBy: { createdAt: "desc" },
          include: { team: true }
        })
      : Promise.resolve([]),
    db.player.groupBy({
      by: ["position"],
      where: { ...teamWhere, status: "ACTIVE" },
      _count: true
    }),
    db.inventoryItem.groupBy({
      by: ["category"],
      where: teamId ? { teamId } : {},
      _sum: { quantity: true }
    }),
    db.team.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        _count: { select: { players: { where: { status: "ACTIVE" } } } }
      }
    }),
    db.clubSettings.findUnique({
      where: { id: "singleton" },
      select: { dashboardWelcomeBannerUrl: true }
    })
  ]);

  // Budgets & Expenses & Debt
  const totalAllocatedBudget = budgetTotals._sum.allocatedAmount ?? 0;
  const totalPostedExpenses = postedExpensesAgg._sum.amount ?? 0;
  const debtSummary = debtSummaryResult ?? { hasDebt: false, debtAmount: 0, totalTreasuryBalance: 0 };
  const isDebt = debtSummary.hasDebt;
  const debtAmount = debtSummary.debtAmount;
  const totalTreasuryBalance = debtSummary.totalTreasuryBalance;
  const remainingBudget = Math.max(0, totalAllocatedBudget - totalPostedExpenses);

  // Compute 6 months monthly trend data for chart
  const monthsNamesAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const monthsNamesFr = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  const trendDataMap = new Map<string, { inflow: number; expense: number }>();

  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    trendDataMap.set(key, { inflow: 0, expense: 0 });
  }

  for (const tx of monthlyTransactionTotals) {
    const d = new Date(tx.month);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (trendDataMap.has(key)) {
      const pt = trendDataMap.get(key)!;
      if (tx.type === "DEPOSIT") {
        pt.inflow += tx.total;
      } else {
        pt.expense += tx.total;
      }
    }
  }

  const monthlyTrend: MonthlyTrendPoint[] = [];
  trendDataMap.forEach((val, key) => {
    const parts = key.split("-");
    const mIdx = parts[1] ? parseInt(parts[1], 10) : 0;
    const mName = (locale === "ar" ? monthsNamesAr[mIdx] : monthsNamesFr[mIdx]) || "";
    monthlyTrend.push({
      month: mName,
      inflow: val.inflow,
      expense: val.expense
    });
  });

  // Compute Expense Category Slices for Donut
  const sliceColors = ["#DC2626", "#111214", "#4B5563", "#9CA3AF", "#EF4444"];
  const categorySlices: ExpenseSlice[] = expenseCategoriesGrouped.map((cg, idx) => ({
    name: cg.category ? tFinance(`categories.${cg.category}` as any) : tFinance("categories.OTHER"),
    value: cg._sum.amount ?? 0,
    color: sliceColors[idx % sliceColors.length] || "#DC2626"
  }));

  const currencySuffix = locale === "ar" ? " د.ج" : " DZD";
  const formatMoney = (val: number) => val.toLocaleString(locale) + currencySuffix;

  // Build unified recent financial operations (Deposits, Withdrawals, Expenses)
  type UnifiedOperation = {
    id: string;
    kind: "DEPOSIT" | "WITHDRAWAL" | "EXPENSE";
    title: string;
    subtitle: string;
    amount: number;
    createdAt: Date;
  };

  const unifiedOperations: UnifiedOperation[] = [];

  for (const tx of recentTransactions) {
    const isDeposit = tx.type === "DEPOSIT";
    unifiedOperations.push({
      id: `tx-${tx.id}`,
      kind: isDeposit ? "DEPOSIT" : "WITHDRAWAL",
      title:
        tx.referenceNumber ||
        (tx.relatedExpense
          ? tx.relatedExpense.referenceNumber
          : tx.description ?? (isDeposit ? (locale === "ar" ? "إيداع بنكي / صندوق" : "Dépôt") : (locale === "ar" ? "سحب نقدي" : "Retrait"))),
      subtitle: tx.treasuryAccount?.name ?? (locale === "ar" ? "حساب الخزينة" : "Compte de trésorerie"),
      amount: tx.amount,
      createdAt: tx.createdAt
    });
  }

  for (const exp of recentExpenses) {
    unifiedOperations.push({
      id: `exp-${exp.id}`,
      kind: "EXPENSE",
      title: exp.description || exp.referenceNumber || (locale === "ar" ? "مصروف معتمد" : "Dépense"),
      subtitle: exp.team?.name ? `${exp.team.name} • ${exp.category}` : exp.category || (locale === "ar" ? "مصروف عام" : "Dépense générale"),
      amount: exp.amount,
      createdAt: exp.createdAt
    });
  }

  // Sort by createdAt descending and take top 5
  unifiedOperations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const displayOperations = unifiedOperations.slice(0, 5);

  // Prepare Players by Position data for carousel
  const posNamesAr: Record<string, string> = {
    FORWARD: "هجوم",
    MIDFIELDER: "وسط الميدان",
    DEFENDER: "دفاع",
    GOALKEEPER: "حراسة المرمى"
  };
  const posNamesFr: Record<string, string> = {
    FORWARD: "Attaquants",
    MIDFIELDER: "Milieux",
    DEFENDER: "Défenseurs",
    GOALKEEPER: "Gardiens"
  };

  const positionSlices = playersByPosition.map((p) => ({
    position: p.position,
    name: (locale === "ar" ? posNamesAr[p.position] : posNamesFr[p.position]) || p.position,
    count: p._count
  }));

  // Prepare Inventory Categories data for carousel
  const invNamesAr: Record<string, string> = {
    BALLS: "كرات رسمية وتدريب",
    KITS: "أطقم وألبسة رياضية",
    CONES_MARKERS: "أقماع وحواجز تدريب",
    GOALKEEPING: "معدات حراسة المرمى",
    MEDICAL: "معدات طبية وإسعافات",
    TRAINING_AIDS: "أجهزة ومساعدات لياقة",
    ELECTRONICS: "أجهزة إلكترونية وتوقيت",
    OTHER: "أدوات ومعدات عامة"
  };
  const invNamesFr: Record<string, string> = {
    BALLS: "Ballons",
    KITS: "Jeux de maillots",
    CONES_MARKERS: "Plots et coupelles",
    GOALKEEPING: "Équipements gardiens",
    MEDICAL: "Matériel médical",
    TRAINING_AIDS: "Accessoires fitness",
    ELECTRONICS: "Chronomètres & Élec.",
    OTHER: "Divers"
  };

  let totalEquipmentQuantity = 0;
  const inventorySlices = inventoryStats.map((inv) => {
    const qty = inv._sum.quantity ?? 0;
    totalEquipmentQuantity += qty;
    return {
      category: inv.category,
      name: (locale === "ar" ? invNamesAr[inv.category] : invNamesFr[inv.category]) || inv.category,
      count: qty
    };
  });

  const CATEGORY_ORDER = ["SENIOR", "U20", "U17", "U15"];
  const sortedTeamsWithPlayers = [...teamsWithPlayers].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  );

  const teamsSquadSlices = sortedTeamsWithPlayers.map((tm) => ({
    teamName: tTeams(`categories.${tm.category}` as any) || tm.name,
    category: tm.category,
    count: tm._count.players
  }));

  return (
    <div className="space-y-6">
      {/* Debt Warning Banner */}
      {canViewFinance && isDebt && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/50 bg-gradient-to-r from-red-500/15 via-red-500/10 to-amber-500/10 p-5 shadow-md">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-red-600 dark:text-red-400">
                  {locale === "ar" ? "تنبيه مالي: النادي في حالة مديونية" : "Alerte Financière : Situation d'Endettement"}
                </h3>
                <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-0.5 text-xs font-black text-white shadow-xs">
                  {locale === "ar" ? `مديون بمبلغ: ${formatMoney(debtAmount)}` : `Dette : ${formatMoney(debtAmount)}`}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
                {locale === "ar"
                  ? `هذا المبلغ محسوب من المصروفات المعتمدة المسجلة كديون وغير المرتبطة بسداد خزينة موثق. تحويل الأموال بين البنك والصندوق لا يسدد ديناً بحد ذاته.`
                  : `Ce montant correspond aux dépenses validées enregistrées comme dettes sans paiement de trésorerie associé. Un transfert entre banque et caisse ne règle pas une dette à lui seul.`}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href={`/${locale}/dashboard/finance`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 underline underline-offset-4"
                >
                  <span>{locale === "ar" ? "الانتقال إلى الإدارة المالية ←" : "Consulter la gestion financière ←"}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. ROW 1: PERSONALIZED WELCOME BANNER + 4 KPI CARDS (Concept Image 1) */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
        {/* Personalized Welcome Banner with Official Custom Club Header */}
        <div
          className="lg:col-span-5 relative overflow-hidden rounded-2xl border border-border/80 bg-zinc-900 p-6 text-white shadow-md flex flex-col justify-between min-h-[220px]"
        >
          {/* The browser decodes only this visible banner; GIF animation uses native image playback. */}
          <SafeImage
            src={dashboardBranding?.dashboardWelcomeBannerUrl || "/branding/esh-header-crest.png"}
            fallbackSrc="/branding/esh-header-crest.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Dark scrim overlay for high legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40 pointer-events-none" />

          {/* Banner Top Header with Crest */}
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight font-display">
                {locale === "ar" ? `مرحباً، ${user.name}` : `Bienvenue, ${user.name}`}
              </h1>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                {locale === "ar"
                  ? "كل شيء تحت السيطرة .. هيا نحو المزيد من الإنجازات"
                  : "Opérations sous contrôle .. Vers de nouvelles victoires"}
              </p>
            </div>

            {/* Club Crest in Banner */}
            <div className="h-12 w-12 shrink-0 rounded-xl bg-black/40 border border-white/10 p-2 backdrop-blur-xs flex items-center justify-center">
              <SafeImage src="/branding/esh-logo-64.png" fallbackSrc="/branding/esh-logo-64.png" alt="ESH" className="h-9 w-9 object-contain" />
            </div>
          </div>

          {/* Banner Bottom Slogan */}
          <div className="relative z-10 pt-6">
            <p className="text-[11px] font-extrabold tracking-widest text-zinc-300 uppercase">
              Together We Build The Future
            </p>
            <div className="mt-1 h-0.5 w-12 bg-club-primary" />
          </div>
        </div>

        {/* 4 KPI Metric Cards (lg:col-span-7) */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* KPI 1: Active Players */}
          <Link
            href={`/${locale}/dashboard/players`}
            className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:border-club-primary/40 hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground">{t("activePlayers")}</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-club-primary/10 text-club-primary">
                <Users className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="my-2">
              <span className="text-2xl font-black font-mono tabular-nums text-foreground group-hover:text-club-primary transition-colors">
                {activePlayers}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span>●</span>
              <span className="text-muted-foreground">{locale === "ar" ? "جاهزون للمنافسة" : "opérationnels"}</span>
            </div>
          </Link>

          {/* KPI 2: Technical & Administrative Staff */}
          <Link
            href={`/${locale}/dashboard/staff`}
            className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:border-club-primary/40 hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground">
                {locale === "ar" ? "الطاقم الفني والإداري" : "Staff Technique"}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Shield className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="my-2">
              <span className="text-2xl font-black font-mono tabular-nums text-foreground group-hover:text-club-primary transition-colors">
                {activeStaff}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
              <span>●</span>
              <span className="text-muted-foreground">{locale === "ar" ? "مدربين ومسيرين" : "membres actifs"}</span>
            </div>
          </Link>

          {/* KPI 3: Scheduled Matches */}
          <Link
            href={`/${locale}/dashboard/matches`}
            className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:border-club-primary/40 hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground">
                {locale === "ar" ? "المباريات المبرمجة" : "Matchs Programmés"}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Trophy className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="my-2">
              <span className="text-2xl font-black font-mono tabular-nums text-foreground group-hover:text-club-primary transition-colors">
                {upcomingMatches.length}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span>●</span>
              <span className="text-muted-foreground">{locale === "ar" ? "لقاءات رسمية قادمة" : "rencontres à venir"}</span>
            </div>
          </Link>

          {/* KPI 4: Official Documents & Meetings */}
          <Link
            href={`/${locale}/dashboard/documents`}
            className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:border-club-primary/40 hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground">
                {locale === "ar" ? "المحاضر والوثائق" : "Actes & Documents"}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                <FileText className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="my-2">
              <span className="text-2xl font-black font-mono tabular-nums text-foreground group-hover:text-club-primary transition-colors">
                {recentMeetings.length}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
              <span>●</span>
              <span className="text-muted-foreground">{locale === "ar" ? "محاضر رسمية معتمدة" : "procès-verbaux"}</span>
            </div>
          </Link>
        </div>
      </section>

      {/* 2. ROW 2: 4 QUICK-ACTION NAVIGATION CARDS (Concept Image 1) */}
      <section className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${canViewFinance ? (canViewTacticsCard ? "md:grid-cols-4" : "md:grid-cols-3") : (canViewTacticsCard ? "md:grid-cols-2" : "md:grid-cols-1")}`}>
        {/* Coach-only action: Tactical planning */}
        {canViewTacticsCard && <Link
          href={`/${locale}/dashboard/tactics`}
          className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:border-club-primary/40 hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-club-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground group-hover:text-club-primary transition-colors truncate">
                {locale === "ar" ? "الخطط والتكتيك" : "Plans & tactiques"}
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">
                {locale === "ar" ? `${tacticalPlansCount} خطة محفوظة` : `${tacticalPlansCount} plan(s) enregistré(s)`}
              </p>
            </div>
          </div>
          <Arrow className="h-4 w-4 text-muted-foreground group-hover:text-club-primary transition-colors shrink-0" />
        </Link>}

        {/* Action 2: Expenses */}
        {canViewFinance && <Link
          href={`/${locale}/dashboard/finance/expenses`}
          className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:border-club-primary/40 hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-club-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground group-hover:text-club-primary transition-colors truncate">
                {locale === "ar" ? "المصروفات" : "Dépenses"}
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">
                {locale === "ar" ? "إضافة ومتابعة المصروفات" : "Engagements & paiements"}
              </p>
            </div>
          </div>
          <Arrow className="h-4 w-4 text-muted-foreground group-hover:text-club-primary transition-colors shrink-0" />
        </Link>}

        {/* Action 3: Treasury */}
        {canViewFinance && <Link
          href={`/${locale}/dashboard/finance/treasury`}
          className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:border-club-primary/40 hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-club-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground group-hover:text-club-primary transition-colors truncate">
                {locale === "ar" ? "الخزينة" : "Trésorerie"}
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">
                {locale === "ar" ? "إيداع، سحب وتحويل الأموال" : "Dépôts, retraits, virements"}
              </p>
            </div>
          </div>
          <Arrow className="h-4 w-4 text-muted-foreground group-hover:text-club-primary transition-colors shrink-0" />
        </Link>}

        {/* Action 4: Documents */}
        <Link
          href={`/${locale}/dashboard/documents`}
          className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:border-club-primary/40 hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-club-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground group-hover:text-club-primary transition-colors truncate">
                {locale === "ar" ? "المستندات" : "Documents"}
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">
                {locale === "ar" ? "إدارة الوثائق الرسمية للنادي" : "Actes et courriers officiels"}
              </p>
            </div>
          </div>
          <Arrow className="h-4 w-4 text-muted-foreground group-hover:text-club-primary transition-colors shrink-0" />
        </Link>
      </section>

      {/* 3. ROW 3: FINANCIAL HEALTH CHART (BUDGET + EXPENSES + TREASURY) + URGENT TASKS */}
      <section className={`grid grid-cols-1 gap-5 items-stretch ${canViewFinance ? "lg:grid-cols-12" : "lg:grid-cols-1"}`}>
        {/* Advanced Financial Health Chart (lg:col-span-7) */}
        {canViewFinance && <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {locale === "ar" ? "المؤشرات المالية والخزينة" : "Santé Financière & Trésorerie"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {locale === "ar" ? "المتابعة الميزانياتية" : "Suivi budgétaire"}
                </p>
              </div>
              <Link
                href={`/${locale}/dashboard/finance`}
                className="text-xs font-semibold text-club-primary hover:underline flex items-center gap-1"
              >
                <span>{locale === "ar" ? "الإدارة المالية" : "Finance"}</span>
                <Arrow className="h-3 w-3" />
              </Link>
            </div>

            <FinancialHealthChart
              data={monthlyTrend}
              remainingBudget={remainingBudget}
              totalPostedExpenses={totalPostedExpenses}
              totalTreasuryBalance={totalTreasuryBalance}
              totalAllocatedBudget={totalAllocatedBudget}
              locale={locale}
            />
          </div>
        </div>}

        {/* Players & Equipment Carousel (lg:col-span-5) */}
        <div className={`${canViewFinance ? "lg:col-span-5" : "lg:col-span-1"} flex flex-col h-full`}>
          <PlayersAndEquipmentCarousel
            positions={positionSlices}
            inventoryCategories={inventorySlices}
            teamsSquad={teamsSquadSlices}
            totalActivePlayers={activePlayers}
            totalEquipmentQuantity={totalEquipmentQuantity}
            locale={locale}
          />
        </div>
      </section>

      {/* 4. ROW 4: EVENTS CAROUSEL + URGENT TASKS + EXPENSE DONUT */}
      <section className={`grid grid-cols-1 gap-5 items-stretch ${canViewFinance ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
        {/* Card 1: 3-Slide Carousel (Matches, Trainings, Meetings) */}
        <DashboardEventsCarousel
          matches={upcomingMatches.map((m) => ({
            id: m.id,
            opponentName: m.isHomeFixture ? m.awayTeamName : m.homeTeamName,
            matchDate: m.matchDate,
            isHome: m.isHomeFixture,
            competitionName: m.competition?.name,
            opponentLogo: findOpponentLogo(opponentLogos, m.isHomeFixture ? m.awayTeamName : m.homeTeamName)
          }))}
          trainings={upcomingTrainings.map((tr) => ({
            id: tr.id,
            teamCategory: tr.team ? tTeams(`categories.${tr.team.category}` as any) : (locale === "ar" ? "الفريق الأول" : "Séniors"),
            date: tr.date,
            startTime: tr.startTime,
            location: tr.location
          }))}
          meetings={recentMeetings.map((me) => ({
            id: me.id,
            title: me.title,
            meetingDate: me.date,
            location: me.location
          }))}
          locale={locale}
        />

        {/* Card 2: Expense Distribution (Glowing Color Gradient Donut) */}
        {canViewFinance && <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-2">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-club-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {locale === "ar" ? "توزيع المصروفات" : "Répartition Dépenses"}
                </h3>
              </div>
            </div>

            <ExpenseDistributionDonut
              slices={categorySlices}
              totalAmount={totalPostedExpenses}
              locale={locale}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 text-center">
            <Link
              href={`/${locale}/dashboard/finance/expenses`}
              className="text-[11px] font-semibold text-club-primary hover:underline"
            >
              {locale === "ar" ? "عرض تقرير المصروفات المفصل" : "Rapport détaillé"}
            </Link>
          </div>
        </div>}

        {/* Card 3: Recent Transactions */}
        {canViewFinance && <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-club-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {locale === "ar" ? "آخر المعاملات" : "Dernières Opérations"}
                </h3>
              </div>
              <Link
                href={`/${locale}/dashboard/finance/treasury`}
                className="text-xs font-semibold text-muted-foreground hover:text-club-primary transition-colors flex items-center gap-1"
              >
                <span>{locale === "ar" ? "عرض الكل" : "Tout voir"}</span>
                <Arrow className="h-3 w-3" />
              </Link>
            </div>

            {displayOperations.length > 0 ? (
              <div className="divide-y divide-border/60">
                {displayOperations.map((op) => {
                  const isDeposit = op.kind === "DEPOSIT";
                  const isWithdrawal = op.kind === "WITHDRAWAL";
                  const isExpense = op.kind === "EXPENSE";

                  return (
                    <div key={op.id} className="flex items-center justify-between py-2.5 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            isDeposit
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : isWithdrawal
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isDeposit ? (
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          ) : isWithdrawal ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <Receipt className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{op.title}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate">
                            <span
                              className={`font-semibold ${
                                isDeposit
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : isWithdrawal
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {isDeposit
                                ? (locale === "ar" ? "مدخول" : "Recette")
                                : isWithdrawal
                                ? (locale === "ar" ? "سحب" : "Retrait")
                                : (locale === "ar" ? "مصروف" : "Dépense")}
                            </span>
                            <span>•</span>
                            <span className="truncate">{op.subtitle}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-end ps-2 shrink-0">
                        <span
                          className={`font-mono tabular-nums font-bold ${
                            isDeposit
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isWithdrawal
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isDeposit ? "+" : "-"}{formatMoney(op.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-muted-foreground">
                <p>{tFinance("overview.noRecentTransactions")}</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 text-center">
            <span className="text-[11px] text-muted-foreground">
              {locale === "ar" ? "السجل المحاسبي" : "Journal comptable"}
            </span>
          </div>
        </div>}
      </section>
    </div>
  );
}
