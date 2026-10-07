import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePagePermission } from "@/lib/permissions";
import { computeInsights, filterInsightsForUser } from "@/lib/insights/rules";
import { Badge } from "@/components/ui/badge";
import { SettingsNavTabs } from "@/components/settings/settings-nav-tabs";

const SEVERITY_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  info: "neutral",
  warning: "warning",
  critical: "danger"
};

export default async function DataQualityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requirePagePermission("reports.view", locale);
  const t = await getTranslations("insights");
  const tCommon = await getTranslations("common");

  // Finance data-quality findings need finance.view on top of reports.view.
  const insights = filterInsightsForUser(await computeInsights({ permissions: user.permissions }), user);
  const dataQualityIssues = insights.filter((i) => i.category === "dataQuality");

  const grouped = new Map<string, typeof dataQualityIssues>();
  for (const issue of dataQualityIssues) {
    grouped.set(issue.type, [...(grouped.get(issue.type) ?? []), issue]);
  }

  return (
    <div>
      <SettingsNavTabs locale={locale} />
      <h1 className="mb-4 text-xl font-semibold">{t("dataQualityCenter")}</h1>

      {dataQualityIssues.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t("noIssues")}</p>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([type, issues]) => (
            <section key={type} className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">
                {t(`typeLabels.${type}` as any)} ({issues.length})
              </h2>
              <ul className="divide-y divide-border">
                {issues.map((issue) => (
                  <li key={issue.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/${locale}${issue.link}`} className="flex min-w-0 items-center gap-2">
                      <Badge tone={SEVERITY_TONE[issue.severity]}>{t(`severities.${issue.severity}` as any)}</Badge>
                      <span className="truncate">{t(`types.${issue.type}` as any, issue.params as any)}</span>
                    </Link>
                    <Link href={`/${locale}${issue.link}`} className="shrink-0 text-xs text-club-primary underline">
                      {tCommon("edit")}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
