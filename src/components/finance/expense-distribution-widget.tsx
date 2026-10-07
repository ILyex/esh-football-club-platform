"use client";

import { PieChart, Utensils, Bus, Shirt, Building2, HelpCircle, CheckCircle, ShieldCheck } from "lucide-react";

interface CategoryExpenseItem {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

interface ExpenseDistributionWidgetProps {
  categories: CategoryExpenseItem[];
  totalSpent: number;
  currencySuffix?: string;
  locale?: string;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MEALS: Utensils,
  TRAVEL: Bus,
  EQUIPMENT: Shirt,
  ADMINISTRATION: Building2,
  MATCH: ShieldCheck,
  OTHER: HelpCircle
};

const CATEGORY_LABELS_AR: Record<string, string> = {
  MEALS: "الإطعام والوجبات",
  TRAVEL: "التنقلات والرحلات",
  EQUIPMENT: "شراء العتاد والألبسة",
  ADMINISTRATION: "المصاريف الإدارية والتحكيم",
  MATCH: "مصاريف تنظيم المباريات",
  TRAINING: "مصاريف الحصص التدريبية",
  MEDICAL: "المصاريف الطبية والإسعاف",
  OTHER: "مصاريف تسيير أخرى"
};

// Category colors are tied to the category key, never to its current sort order.
const CATEGORY_COLORS: Record<string, string> = {
  FOOD: "from-amber-500 to-orange-600",
  MEALS: "from-amber-500 to-orange-600",
  TRANSPORT: "from-blue-500 to-sky-600",
  TRAVEL: "from-blue-500 to-sky-600",
  EQUIPMENT: "from-violet-500 to-indigo-600",
  LODGING: "from-cyan-500 to-teal-600",
  MEDICAL: "from-rose-500 to-red-600",
  ADMINISTRATION: "from-slate-500 to-zinc-600",
  TRAINING: "from-emerald-500 to-teal-600",
  MATCH: "from-red-500 to-rose-600",
  OTHER: "from-zinc-500 to-slate-600"
};

export function ExpenseDistributionWidget({
  categories,
  totalSpent,
  currencySuffix = " دج",
  locale = "ar"
}: ExpenseDistributionWidgetProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-muted/30 p-6 sm:p-7 shadow-xl shadow-black/5 dark:shadow-red-950/10">
      {/* Ambient Luxury Glow Accent */}
      <div className="pointer-events-none absolute -top-24 -end-24 h-48 w-48 rounded-full bg-club-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -start-24 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-club-primary/20 bg-club-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-club-primary uppercase tracking-wider mb-1">
            <PieChart className="h-3 w-3" />
            <span>{locale === "ar" ? "توزيع بنود الصرف المعتمدة" : "Répartition des Dépenses"}</span>
          </div>
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">
            {locale === "ar" ? "تفصيل المصاريف التشغيلية للنادي" : "Ventilation Opérationnelle"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === "ar"
              ? "كافة النفقات موثقة ومبررة رسمياً بالفواتير والوصولات القانونية"
              : "Toutes les dépenses sont justifiées par pièces comptables"}
          </p>
        </div>

        <div className="text-start sm:text-end bg-muted/40 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-border/50">
          <span className="text-[11px] font-semibold text-muted-foreground block">
            {locale === "ar" ? "إجمالي المنصرف المبرر" : "Total Dépensé"}
          </span>
          <span className="font-mono text-xl sm:text-2xl font-black text-foreground" dir="ltr">
            {totalSpent.toLocaleString(locale)}
            <span className="text-sm font-semibold text-muted-foreground ms-1">{currencySuffix}</span>
          </span>
        </div>
      </div>

      {/* Categories Breakdown List */}
      <div className="relative mt-6 space-y-4">
        {categories.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {locale === "ar" ? "لا توجد مصاريف معتمدة مسجلة حالياً." : "Aucune dépense comptabilisée."}
          </div>
        ) : (
          categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.category] || HelpCircle;
            const label = CATEGORY_LABELS_AR[cat.category] || cat.category;
            const gradient = CATEGORY_COLORS[cat.category] ?? CATEGORY_COLORS.OTHER;

            return (
              <div key={cat.category} className="group rounded-2xl border border-border/60 bg-muted/20 p-3.5 transition-all hover:bg-muted/40 hover:border-border">
                <div className="flex items-center justify-between gap-3 text-xs mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-xs`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{label}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">
                        {cat.count} {locale === "ar" ? "عملية/فاتورة مبررة" : "justificatifs"}
                      </p>
                    </div>
                  </div>

                  <div className="text-end shrink-0">
                    <p className="font-mono font-bold text-foreground text-sm" dir="ltr">
                      {cat.amount.toLocaleString(locale)} {currencySuffix}
                    </p>
                    <span className="inline-block font-mono text-[10px] font-semibold text-muted-foreground">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>

                {/* Smooth Progress Indicator Bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                    style={{ width: `${Math.min(100, Math.max(2, cat.percentage))}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Institutional Transparency Footnote */}
      <div className="relative mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          <span>{locale === "ar" ? "حساب موحد للنادي — شفافية كاملة" : "Compte unique du club — Traçabilité 100%"}</span>
        </div>
        <span className="font-mono text-[10px]">Association Sportive Espoir Sidi Hosni de Football • DZD</span>
      </div>
    </div>
  );
}
