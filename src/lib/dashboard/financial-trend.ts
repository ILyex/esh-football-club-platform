import "server-only";

import { unstable_cache } from "next/cache";
import { queryMonthlyFinancialTrend, type DashboardFinancialTrendRow } from "@/lib/finance/treasury-service";

export type { DashboardFinancialTrendRow };

/**
 * Aggregate treasury rows in PostgreSQL and cache the compact result briefly.
 * The dashboard only needs monthly totals; loading every ledger row into the
 * Node process adds network, memory, and CPU cost without improving accuracy.
 */
const getCachedMonthlyTrend = unstable_cache(
  async (startIso: string): Promise<DashboardFinancialTrendRow[]> => {
    return queryMonthlyFinancialTrend(startIso);
  },
  ["dashboard-monthly-treasury-trend"],
  { revalidate: 60, tags: ["dashboard-financial-trend"] }
);

export function getDashboardFinancialTrend(startDate: Date) {
  return getCachedMonthlyTrend(startDate.toISOString());
}
