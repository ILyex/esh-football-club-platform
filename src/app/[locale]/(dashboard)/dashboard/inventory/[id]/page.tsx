import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionOrThrow, hasPermission } from "@/lib/permissions";
import { getAuthorizedTeams } from "@/lib/team-context";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/dashboard/inventory`}
            className="rounded-md border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <BackIcon className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{item.name}</h1>
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

      <form action={updateAction} className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.name")}</label>
          <input
            name="name"
            defaultValue={item.name}
            required
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.category")}</label>
          <select
            name="category"
            required
            defaultValue={item.category}
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            {["BALLS", "KITS", "CONES_MARKERS", "GOALKEEPING", "MEDICAL", "TRAINING_AIDS", "ELECTRONICS", "OTHER"].map(
              (c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}` as any)}
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.quantity")}</label>
          <input
            name="quantity"
            type="number"
            min={1}
            defaultValue={item.quantity}
            required
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.condition")}</label>
          <select
            name="condition"
            defaultValue={item.condition}
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            {["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"].map((cond) => (
              <option key={cond} value={cond}>
                {t(`conditions.${cond}` as any)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.team")}</label>
          <select
            name="teamId"
            defaultValue={item.teamId ?? ""}
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            <option value="">{t("clubWide")}</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tTeams(`categories.${tm.category}` as any)}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.location")}</label>
          <input
            name="location"
            defaultValue={item.location ?? ""}
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>

        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.notes")}</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={item.notes ?? ""}
            disabled={!canManage}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>

        {canManage && (
          <div className="col-span-2 flex items-center justify-end gap-3 pt-2">
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
