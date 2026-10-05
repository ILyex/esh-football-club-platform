import { Save } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions";
import { runFinanceAction, withNotice } from "@/lib/finance/action-notice";
import { createTreasuryAccountAction } from "../actions";
import { Button } from "@/components/ui/button";
import { NoticeToast } from "@/components/shared/notice-toast";

const TYPES = ["CASH", "BANK", "OTHER"] as const;
const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export default async function NewTreasuryAccountPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { locale } = await params;
  const { notice } = await searchParams;
  await requirePermission("finance.manage");
  const t = await getTranslations("finance");
  const tCommon = await getTranslations("common");

  async function action(formData: FormData) {
    "use server";
    const result = await runFinanceAction(() => createTreasuryAccountAction(formData));
    if (!result.ok) return redirect(withNotice(`/${locale}/dashboard/finance/treasury/new`, result.notice));
    redirect(withNotice(`/${locale}/dashboard/finance/treasury/${result.value.id}`, "finance.success.accountCreated"));
  }

  return (
    <div className="max-w-xl">
      <NoticeToast notice={notice} />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("addAccount")}</h1>
        <Link href={`/${locale}/dashboard/finance/treasury`} className="text-sm text-club-primary underline">
          {tCommon("back")}
        </Link>
      </div>
      <form action={action} className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.name")}</label>
          <input name="name" required maxLength={160} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.accountType")}</label>
          <select name="type" defaultValue="CASH" className={inputClass}>
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`accountTypes.${ty}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("openingBalance")}</label>
          <input name="openingBalance" type="number" min={0} step={1} defaultValue={0} required className={inputClass} />
        </div>
        <p className="col-span-2 text-xs text-muted-foreground">{t("openingBalanceHelp")}</p>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.notes")}</label>
          <textarea name="notes" rows={3} className={inputClass} />
        </div>
        <div className="col-span-2">
          <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
        </div>
      </form>
    </div>
  );
}
