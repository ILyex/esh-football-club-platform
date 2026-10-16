import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getSessionOrThrow, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";
import { InventoryPreviewModal } from "@/components/inventory/inventory-preview-modal";
import { deleteInventoryItemAction } from "./actions";
import { Package, Plus, Search, Shirt, CircleDot, AlertTriangle, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";

const CONDITION_TONE: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  NEW: "success",
  GOOD: "success",
  FAIR: "neutral",
  OLD: "warning",
  POOR: "warning",
  DAMAGED: "danger",
  UNSPECIFIED: "neutral"
};

export default async function InventoryListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string; category?: string; condition?: string; q?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getSessionOrThrow();
  const t = await getTranslations("inventory");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const canManage =
    hasPermission(user, "inventory.manage") ||
    hasPermission(user, "training.manage") ||
    hasPermission(user, "teams.manage");

  const effectiveTeamId = await getEffectiveTeamId(sp.team);

  const where: Prisma.InventoryItemWhereInput = {
    ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}),
    ...(sp.category ? { category: sp.category as any } : {}),
    ...(sp.condition ? { condition: sp.condition as any } : {}),
    ...(sp.q
      ? {
          OR: [
            { name: { contains: sp.q, mode: "insensitive" } },
            { location: { contains: sp.q, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const pageSize = 20;
  const requestedPageValue = Number.parseInt(sp.page ?? "1", 10);
  const requestedPage = Number.isSafeInteger(requestedPageValue) && requestedPageValue > 0 ? requestedPageValue : 1;

  const [itemsCount, teams, allStats] = await Promise.all([
    db.inventoryItem.count({ where }),
    getAuthorizedTeams(),
    db.inventoryItem.groupBy({
      by: ["category", "condition"],
      where: effectiveTeamId ? { teamId: effectiveTeamId } : {},
      _sum: { quantity: true }
    })
  ]);
  const totalPages = Math.max(1, Math.ceil(itemsCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const items = await db.inventoryItem.findMany({
    where,
    include: { team: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize
  });

  const pageUrl = (targetPage: number) => {
    const query = new URLSearchParams();
    if (sp.team) query.set("team", sp.team);
    if (sp.category) query.set("category", sp.category);
    if (sp.condition) query.set("condition", sp.condition);
    if (sp.q) query.set("q", sp.q);
    query.set("page", String(targetPage));
    return `/${locale}/dashboard/inventory?${query.toString()}`;
  };

  let totalItemsCount = 0;
  let totalBallsCount = 0;
  let totalKitsCount = 0;
  let totalDefectiveCount = 0;

  for (const stat of allStats) {
    const qty = stat._sum.quantity ?? 0;
    totalItemsCount += qty;
    if (stat.category === "BALLS") totalBallsCount += qty;
    if (stat.category === "KITS") totalKitsCount += qty;
    if (stat.condition === "POOR" || stat.condition === "DAMAGED") totalDefectiveCount += qty;
  }

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <InventoryPreviewModal
            items={items}
            locale={locale}
            categoryLabels={{
              BALLS: t("categories.BALLS"),
              KITS: t("categories.KITS"),
              CONES_MARKERS: t("categories.CONES_MARKERS"),
              GOALKEEPING: t("categories.GOALKEEPING"),
              MEDICAL: t("categories.MEDICAL"),
              TRAINING_AIDS: t("categories.TRAINING_AIDS"),
              ELECTRONICS: t("categories.ELECTRONICS"),
              OTHER: t("categories.OTHER")
            }}
            teamLabels={{
              SENIOR: tTeams("categories.SENIOR"),
              U20: tTeams("categories.U20"),
              U17: tTeams("categories.U17"),
              U15: tTeams("categories.U15")
            }}
            conditionLabels={{
              NEW: t("conditions.NEW"),
              GOOD: t("conditions.GOOD"),
              FAIR: t("conditions.FAIR"),
              OLD: t("conditions.OLD"),
              POOR: t("conditions.POOR"),
              DAMAGED: t("conditions.DAMAGED"),
              UNSPECIFIED: t("conditions.UNSPECIFIED")
            }}
          />
          {canManage && (
            <Link href={`/${locale}/dashboard/inventory/new`}>
              <Button size="sm" className="inline-flex items-center gap-1.5 text-xs font-semibold shadow-2xs">
                <Plus className="h-4 w-4 shrink-0" />
                {t("addItem")}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t("stats.totalEquipment")}</p>
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold">{totalItemsCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">{itemsCount} {t("stats.uniqueEntries")}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t("categories.BALLS")}</p>
            <div className="rounded-full bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
              <CircleDot className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold">{totalBallsCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("stats.inStock")}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t("categories.KITS")}</p>
            <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <Shirt className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold">{totalKitsCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("stats.kitsAndJerseys")}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t("stats.maintenanceRequired")}</p>
            <div className="rounded-full bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className={`mt-2 text-2xl font-bold ${totalDefectiveCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
            {totalDefectiveCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t("stats.poorOrDamaged")}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <form className="dashboard-filter-toolbar mb-4 print:hidden">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-md border border-border bg-background ps-9 pe-3 py-1.5 text-xs"
            />
          </div>
        </div>

        <MasterFilterSelect
          name="category"
          locale={locale === "ar" ? "ar" : "fr"}
          label={locale === "ar" ? "الفئة:" : "Catégorie :"}
          value={sp.category ?? ""}
          options={[
            { id: "", label: t("allCategories") },
            ...["BALLS", "KITS", "CONES_MARKERS", "GOALKEEPING", "MEDICAL", "TRAINING_AIDS", "ELECTRONICS", "OTHER"].map((c) => ({ id: c, label: t(`categories.${c}` as any) }))
          ]}
          headerTitle={locale === "ar" ? "تصفية حسب الفئة" : "Filtrer par catégorie"}
        />

        <MasterFilterSelect
          name="condition"
          locale={locale === "ar" ? "ar" : "fr"}
          label={locale === "ar" ? "الحالة:" : "État :"}
          value={sp.condition ?? ""}
          options={[
            { id: "", label: t("allConditions") },
            ...["NEW", "GOOD", "FAIR", "OLD", "POOR", "DAMAGED", "UNSPECIFIED"].map((cond) => ({ id: cond, label: t(`conditions.${cond}` as any) }))
          ]}
          headerTitle={locale === "ar" ? "تصفية حسب الحالة" : "Filtrer par état"}
        />

        <Button type="submit" variant="outline" size="sm" className="h-8 text-xs">
          {tCommon("filter")}
        </Button>
      </form>

      {/* Equipment Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm print:hidden">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-start">{t("fields.name")}</th>
              <th className="px-4 py-3 text-start">{t("fields.category")}</th>
              <th className="px-4 py-3 text-start">{t("fields.quantity")}</th>
              <th className="px-4 py-3 text-start">{t("fields.condition")}</th>
              <th className="px-4 py-3 text-start">{t("fields.team")}</th>
              <th className="px-4 py-3 text-start">{t("fields.location")}</th>
              <th className="px-4 py-3 text-start">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              async function remove() {
                "use server";
                await deleteInventoryItemAction(item.id);
              }
              return (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{item.name}</p>
                    {item.notes && <p className="text-xs text-muted-foreground truncate max-w-xs">{item.notes}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="neutral">{t(`categories.${item.category}` as any)}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-foreground">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={CONDITION_TONE[item.condition] ?? "neutral"}>
                      {t(`conditions.${item.condition}` as any)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {item.team ? (
                      <span className="font-medium text-xs">
                        {tTeams(`categories.${item.team.category}` as any)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">{t("clubWide")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {item.location || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/${locale}/dashboard/inventory/${item.id}`}
                        className="text-xs font-medium text-club-primary hover:underline"
                      >
                        {tCommon("edit")}
                      </Link>
                      {canManage && (
                        <ConfirmDialog onConfirm={remove}>
                          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{tCommon("delete")}</span>
                          </button>
                        </ConfirmDialog>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="font-medium">{t("noItemsFound")}</p>
                  <p className="mt-1 text-xs">{t("noItemsHint")}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {itemsCount > 0 && (
        <nav aria-label={locale === "ar" ? "صفحات العتاد" : "Pages de l’inventaire"} className="flex flex-col gap-3 rounded-lg border border-border bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <p className="text-xs text-muted-foreground">
            {t("paginationSummary", { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, itemsCount), total: itemsCount })}
          </p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            {page <= 1
              ? <span aria-disabled="true" className="inline-flex h-9 min-w-24 items-center justify-center rounded-md border border-border px-3 text-xs text-muted-foreground opacity-50">{tCommon("previousPage")}</span>
              : <Link href={pageUrl(page - 1)} className="inline-flex h-9 min-w-24 items-center justify-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">{tCommon("previousPage")}</Link>}
            <span className="min-w-24 text-center text-xs font-semibold text-muted-foreground">
              {tCommon("pageOf", { page, pages: totalPages })}
            </span>
            {page >= totalPages
              ? <span aria-disabled="true" className="inline-flex h-9 min-w-24 items-center justify-center rounded-md border border-border px-3 text-xs text-muted-foreground opacity-50">{tCommon("nextPage")}</span>
              : <Link href={pageUrl(page + 1)} className="inline-flex h-9 min-w-24 items-center justify-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">{tCommon("nextPage")}</Link>}
          </div>
        </nav>
      )}

    </div>
  );
}
