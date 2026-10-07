import { Save } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/permissions";
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
  await requirePagePermission("finance.manage", locale);
  const t = await getTranslations("finance");
  const tCommon = await getTranslations("common");

  async function action(formData: FormData) {
    "use server";
    const result = await runFinanceAction(() => createTreasuryAccountAction(formData));
    if (!result.ok) return redirect(withNotice(`/${locale}/dashboard/finance/treasury/new`, result.notice));
    redirect(withNotice(`/${locale}/dashboard/finance/treasury/${result.value.id}`, "finance.success.accountCreated"));
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <NoticeToast notice={notice} />
      <div className="mb-6 flex items-center justify-between border-b border-border/70 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("addAccount")}</h1>
        <Link href={`/${locale}/dashboard/finance/treasury`} className="text-sm text-club-primary underline">
          {tCommon("back")}
        </Link>
      </div>
      <form action={action} className="mx-auto grid w-full max-w-xl grid-cols-1 gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div>
          <label className="mb-2 block text-sm font-semibold">{t("fields.name")}</label>
          <input name="name" required maxLength={160} className={`${inputClass} h-11`} />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
          <label className="mb-2 block text-sm font-semibold">{t("fields.accountType")}</label>
          <select name="type" defaultValue="CASH" className={`${inputClass} h-11`}>
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`accountTypes.${ty}` as any)}
              </option>
            ))}
          </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">{t("openingBalance")}</label>
            <input name="openingBalance" type="number" min={0} step={1} defaultValue={0} required className={`${inputClass} h-11`} />
          </div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{t("openingBalanceHelp")}</p>
        <div>
          <label className="mb-2 block text-sm font-semibold">{t("fields.notes")}</label>
          <textarea name="notes" rows={4} className={inputClass} />
        </div>
        <div className="flex justify-center pt-1">
          <Button type="submit" className="h-10 min-w-32 gap-2 px-6"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
        </div>
      </form>
    </div>
  );
}
