import { useTranslations } from "next-intl";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Timer, TrendingUp, TrendingDown, Minus, Award, Calendar, ExternalLink } from "lucide-react";
import type { PlayerPerformanceTrend } from "@/lib/testing/types";

export interface ProtocolPerformanceGroup {
  definitionCode: string;
  definitionName: string;
  category: string;
  primaryUnit: string;
  secondaryUnit?: string | null;
  trend: PlayerPerformanceTrend;
}

export function PlayerPerformanceCard({
  groups,
  locale
}: {
  groups: ProtocolPerformanceGroup[];
  locale: string;
}) {
  const t = useTranslations("testing");

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-2xs">
        <Timer className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
        <h3 className="text-sm font-semibold text-foreground">{t("playerCard.noTests")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("playerCard.noTestsDesc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-2">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Timer className="h-5 w-5 text-emerald-600" />
          <span>{t("playerCard.sectionTitle")}</span>
        </h2>
        <p className="text-xs text-muted-foreground">{t("playerCard.sectionSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {groups.map((group) => {
          const { trend } = group;
          const hasTrend = trend.previousScore !== null && trend.delta !== null;

          return (
            <div key={group.definitionCode} className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-4">
              {/* Protocol Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-600 uppercase">{group.category}</span>
                    <Badge tone="neutral" className="text-[11px] font-mono">{group.definitionCode}</Badge>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mt-0.5">{group.definitionName}</h3>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{t("playerCard.totalTests")}: <strong className="text-foreground">{trend.totalTests}</strong></span>
                </div>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Latest Score */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase block">{t("playerCard.latestResult")}</span>
                  <p className="text-lg font-bold text-foreground mt-1">
                    {trend.latestDisplay || `${trend.latestScore} ${group.primaryUnit}`}
                  </p>
                  {trend.latestDate && (
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {new Date(trend.latestDate).toLocaleDateString(locale === "ar" ? "ar-DZ" : "fr-FR")}
                    </span>
                  )}
                </div>

                {/* Best Score */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-amber-500" />
                    <span>{t("playerCard.bestScore")}</span>
                  </span>
                  <p className="text-lg font-bold text-emerald-600 mt-1">
                    {trend.bestScore !== null ? `${trend.bestScore.toLocaleString()} ${group.primaryUnit}` : "—"}
                  </p>
                  {trend.bestDate && (
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {new Date(trend.bestDate).toLocaleDateString(locale === "ar" ? "ar-DZ" : "fr-FR")}
                    </span>
                  )}
                </div>

                {/* Trend Delta */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase block">{t("playerCard.changeFromPrev")}</span>
                  {hasTrend ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      {trend.isImproved === true && <TrendingUp className="h-4 w-4 text-emerald-600" />}
                      {trend.isImproved === false && <TrendingDown className="h-4 w-4 text-red-600" />}
                      {trend.isImproved === null && <Minus className="h-4 w-4 text-muted-foreground" />}
                      <span className={`text-base font-bold ${
                        trend.isImproved === true ? "text-emerald-600" : trend.isImproved === false ? "text-red-600" : "text-foreground"
                      }`}>
                        {trend.delta! > 0 ? `+${trend.delta}` : trend.delta} {group.primaryUnit}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">—</p>
                  )}
                </div>

                {/* Percentage Change */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase block">{t("playerCard.pctChange")}</span>
                  {hasTrend && trend.percentageChange !== null ? (
                    <p className={`text-lg font-bold mt-1 ${
                      trend.isImproved === true ? "text-emerald-600" : trend.isImproved === false ? "text-red-600" : "text-foreground"
                    }`}>
                      {trend.percentageChange > 0 ? `+${trend.percentageChange}%` : `${trend.percentageChange}%`}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">—</p>
                  )}
                </div>
              </div>

              {/* Historical Timeline Table */}
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-start">{t("table.date")}</th>
                      <th className="px-3 py-2 text-start">{t("table.session")}</th>
                      <th className="px-3 py-2 text-start">{t("fields.score")}</th>
                      {group.secondaryUnit && <th className="px-3 py-2 text-start">VO₂ تقديري</th>}
                      <th className="px-3 py-2 text-start">{t("table.rank")}</th>
                      <th className="px-3 py-2 text-end">{t("table.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trend.history.map((h) => (
                      <tr key={h.id} className="hover:bg-muted/10">
                        <td className="px-3 py-2 font-mono whitespace-nowrap text-muted-foreground">
                          {new Date(h.date).toLocaleDateString(locale === "ar" ? "ar-DZ" : "fr-FR")}
                        </td>
                        <td className="px-3 py-2 font-medium text-foreground">
                          {h.sessionTitle}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-600">
                          {h.scoreDisplay || `${h.score} ${group.primaryUnit}`}
                          {h.isCorrected && (
                            <span className="ms-1.5 text-[10px] text-amber-600 font-normal">
                              ({t("isCorrected")})
                            </span>
                          )}
                        </td>
                        {group.secondaryUnit && (
                          <td className="px-3 py-2 font-mono text-blue-600 font-medium">
                            {h.secondaryScore ? `${h.secondaryScore} ${group.secondaryUnit}` : "—"}
                          </td>
                        )}
                        <td className="px-3 py-2 font-medium">
                          {h.rank ? `#${h.rank}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-end">
                          <Link href={`/${locale}/dashboard/testing/${h.sessionId}`} className="text-emerald-600 hover:underline inline-flex items-center gap-1">
                            <span>{t("actions.viewSession")}</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
