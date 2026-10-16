import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionOrThrow, hasPermission, ForbiddenError } from "@/lib/permissions";
import { resolveUserTeamContext } from "@/lib/team-context";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { createInventoryItemAction } from "../actions";
import {
  Package,
  ArrowLeft,
  ArrowRight,
  Boxes,
  MapPin,
  Save,
  Tag,
  Activity
} from "lucide-react";

export default async function NewInventoryItemPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionOrThrow();
  const t = await getTranslations("inventory");
  const tCommon = await getTranslations("common");

  const canManage =
    hasPermission(user, "inventory.manage") ||
    hasPermission(user, "training.manage") ||
    hasPermission(user, "teams.manage");

  if (!canManage) {
    throw new ForbiddenError("inventory.manage");
  }

  const teamContext = await resolveUserTeamContext();
  const defaultTeamId = teamContext.canSelectAll ? "" : teamContext.activeTeamId ?? "";

  async function action(formData: FormData) {
    "use server";
    await createInventoryItemAction(formData);
    redirect(`/${locale}/dashboard/inventory`);
  }

  const isAr = locale === "ar";
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const CATEGORIES = [
    "BALLS",
    "KITS",
    "CONES_MARKERS",
    "GOALKEEPING",
    "MEDICAL",
    "TRAINING_AIDS",
    "ELECTRONICS",
    "OTHER"
  ] as const;

  const CONDITIONS = ["NEW", "GOOD", "FAIR", "OLD", "POOR", "DAMAGED", "UNSPECIFIED"] as const;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/dashboard/inventory`}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <BackIcon className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-club-primary/10 text-club-primary">
                <Boxes className="h-3.5 w-3.5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-foreground">{t("addItem")}</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{t("addItemDescription")}</p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-club-primary/10 text-club-primary border border-club-primary/20">
          <Package className="h-3.5 w-3.5" />
          <span>{isAr ? "سجل العتاد والمخزون" : "Inventaire matériel"}</span>
        </span>
      </div>

      {/* ── Form ── */}
      <form action={action} className="space-y-6">
        <input type="hidden" name="teamId" value={defaultTeamId} />
        {/* Section 1: Item Basic Info */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
          <div className="border-b border-border/80 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-club-primary/10 text-club-primary text-xs font-bold">
                1
              </span>
              <h2 className="text-base font-bold text-foreground">
                {isAr ? "تعريف المادة أو العتاد" : "Identification de l'article"}
              </h2>
            </div>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("fields.name")} <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                required
                placeholder={isAr ? "مثال: كرات تدريب مقاس 5 Molten أو أطقم التنافس الرسمية" : "Ex: Ballons d'entraînement T5 Molten"}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium focus:border-club-primary focus:ring-1 focus:ring-club-primary"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("fields.category")} <span className="text-red-500">*</span>
              </label>
              <FormSelect
                name="category"
                required
                locale={locale}
                ariaLabel={t("fields.category")}
                defaultValue="BALLS"
                options={CATEGORIES.map((category) => ({ value: category, label: t(`categories.${category}` as any) }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("fields.quantity")} <span className="text-red-500">*</span>
              </label>
              <input
                name="quantity"
                type="number"
                min={0}
                defaultValue={1}
                required
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-bold [font-family:Arial,sans-serif] focus:border-club-primary focus:ring-1 focus:ring-club-primary"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Condition & Assignment */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
          <div className="border-b border-border/80 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-club-primary/10 text-club-primary text-xs font-bold">
                2
              </span>
              <h2 className="text-base font-bold text-foreground">
                {isAr ? "الحالة التشغيلية والتخزين" : "État de fonctionnement & emplacement"}
              </h2>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("fields.condition")} <span className="text-red-500">*</span>
              </label>
              <FormSelect
                name="condition"
                locale={locale}
                ariaLabel={t("fields.condition")}
                defaultValue="GOOD"
                options={CONDITIONS.map((condition) => ({ value: condition, label: t(`conditions.${condition}` as any) }))}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("fields.location")}
              </label>
              <div className="relative">
                <MapPin className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  name="location"
                  placeholder={isAr ? "مثال: مستودع العتاد بالملعب البلدي — خزانة الكرات 1" : "Ex: Dépôt matériel stade communal — Armoire 1"}
                  className="w-full rounded-xl border border-border bg-background ps-9 pe-3 py-2.5 text-sm focus:border-club-primary focus:ring-1 focus:ring-club-primary"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("fields.notes")}
              </label>
              <textarea
                name="notes"
                rows={3}
                placeholder={isAr ? "أي ملاحظات إضافية، اسم المورد، الفاتورة، أو تعليمات الاستعمال..." : "Remarques complémentaires, fournisseur, facture, instructions..."}
                className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-club-primary focus:ring-1 focus:ring-club-primary"
              />
            </div>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/${locale}/dashboard/inventory`}>
            <Button type="button" variant="outline" className="px-5">
              {tCommon("cancel")}
            </Button>
          </Link>
          <Button
            type="submit"
            className="bg-club-primary hover:bg-club-primary-hover text-white font-medium flex items-center gap-2 px-6 shadow-xs"
          >
            <Save className="h-4 w-4" />
            <span>{tCommon("save")}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
