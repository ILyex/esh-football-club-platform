import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionOrThrow, hasPermission } from "@/lib/permissions";
import { getAuthorizedTeams } from "@/lib/team-context";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { updateInventoryItemAction, deleteInventoryItemAction } from "../actions";
import { Save,  ArrowLeft, ArrowRight, Trash2 } from "lucide-react";

export default async function EditInventoryItemPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await getSessionOrThrow();
  // Same server-side gate as the list page: readability follows the domain
  // permission, never the mere presence of a session.
  if (
    !hasPermission(user, "inventory.manage") &&
    !hasPermission(user, "training.view") &&
    !hasPermission(user, "teams.manage")
  ) {
    redirect(`/${locale === "fr" ? "fr" : "ar"}/access-denied?code=403`);
  }
  const t = await getTranslations("inventory");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const canManage =
    hasPermission(user, "inventory.manage") ||
    hasPermission(user, "training.manage") ||
    hasPermission(user, "teams.manage");

  const item = await db.inventoryItem.findUnique({
    where: { id },
    include: { team: true }
  });

  if (!item) notFound();

  // Team scope check
  const scopeContext = await getMutationScopeContext();
  try {
    assertTeamScope(scopeContext, item.teamId, "InventoryItem", { allowClubWide: true });
  } catch {
    notFound();
  }

  const teams = await getAuthorizedTeams();

  async function updateAction(formData: FormData) {
    "use server";
    await updateInventoryItemAction(id, formData);
    redirect(`/${locale}/dashboard/inventory`);
  }

  async function deleteAction() {
    "use server";
    await deleteInventoryItemAction(id);
    redirect(`/${locale}/dashboard/inventory`);
  }

  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;
  const fieldClassName = "h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20 disabled:cursor-not-allowed disabled:opacity-60";
  const categories = ["BALLS", "KITS", "CONES_MARKERS", "GOALKEEPING", "MEDICAL", "TRAINING_AIDS", "ELECTRONICS", "OTHER"];
  const conditions = ["NEW", "GOOD", "FAIR", "OLD", "POOR", "DAMAGED", "UNSPECIFIED"];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-1 sm:px-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/${locale}/dashboard/inventory`}
            aria-label={tCommon("back")}
            className="shrink-0 rounded-lg border border-border bg-card p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BackIcon className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">{item.name}</h1>
            <p className="text-xs text-muted-foreground">{t("editItemDescription")}</p>
          </div>
        </div>

        {canManage && (
          <ConfirmDialog onConfirm={deleteAction}>
            <Button type="button" variant="destructive" size="sm">
              <Trash2 className="me-1.5 h-3.5 w-3.5" />
              {tCommon("delete")}
            </Button>
          </ConfirmDialog>
        )}
      </div>

      <form action={updateAction} className="grid grid-cols-1 gap-x-5 gap-y-5 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2">
          <label htmlFor="inventory-name" className="mb-2 block text-sm font-semibold">{t("fields.name")}</label>
          <input
            id="inventory-name"
            name="name"
            defaultValue={item.name}
            required
            disabled={!canManage}
            className={fieldClassName}
          />
        </div>

        <div>
          <label htmlFor="inventory-category" className="mb-2 block text-sm font-semibold">{t("fields.category")}</label>
          <FormSelect
            id="inventory-category"
            name="category"
            required
            defaultValue={item.category}
            disabled={!canManage}
            locale={locale}
            ariaLabel={t("fields.category")}
            options={categories.map((category) => ({ value: category, label: t(`categories.${category}` as any) }))}
          />
        </div>

        <div>
          <label htmlFor="inventory-quantity" className="mb-2 block text-sm font-semibold">{t("fields.quantity")}</label>
          <input
            id="inventory-quantity"
            name="quantity"
            type="number"
            min={0}
            defaultValue={item.quantity}
            required
            disabled={!canManage}
            className={`${fieldClassName} font-mono`}
          />
        </div>

        <div>
          <label htmlFor="inventory-condition" className="mb-2 block text-sm font-semibold">{t("fields.condition")}</label>
          <FormSelect
            id="inventory-condition"
            name="condition"
            defaultValue={item.condition}
            disabled={!canManage}
            locale={locale}
            ariaLabel={t("fields.condition")}
            options={conditions.map((condition) => ({ value: condition, label: t(`conditions.${condition}` as any) }))}
          />
        </div>

        <div>
          <label htmlFor="inventory-team" className="mb-2 block text-sm font-semibold">{t("fields.team")}</label>
          <FormSelect
            id="inventory-team"
            name="teamId"
            defaultValue={item.teamId ?? ""}
            disabled={!canManage}
            locale={locale}
            ariaLabel={t("fields.team")}
            options={[
              { value: "", label: t("clubWide") },
              ...teams.map((team) => ({ value: team.id, label: tTeams(`categories.${team.category}` as any) }))
            ]}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="inventory-location" className="mb-2 block text-sm font-semibold">{t("fields.location")}</label>
          <input
            id="inventory-location"
            name="location"
            defaultValue={item.location ?? ""}
            disabled={!canManage}
            className={fieldClassName}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="inventory-notes" className="mb-2 block text-sm font-semibold">{t("fields.notes")}</label>
          <textarea
            id="inventory-notes"
            name="notes"
            rows={4}
            defaultValue={item.notes ?? ""}
            disabled={!canManage}
            className={`${fieldClassName} h-auto min-h-28 resize-y py-3 leading-6`}
          />
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5 sm:col-span-2">
            <Link href={`/${locale}/dashboard/inventory`}>
              <Button type="button" variant="outline">
                {tCommon("cancel")}
              </Button>
            </Link>
            <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
          </div>
        )}
      </form>
    </div>
  );
}
