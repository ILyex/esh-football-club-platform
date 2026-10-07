import { Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePagePermission } from "@/lib/permissions";
import { createRoleAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SettingsNavTabs } from "@/components/settings/settings-nav-tabs";

export default async function NewRolePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("roles.manage", locale);
  const t = await getTranslations("roles");
  const tCommon = await getTranslations("common");

  async function action(formData: FormData) {
    "use server";
    const { id } = await createRoleAction(formData);
    redirect(`/${locale}/dashboard/roles/${id}`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <SettingsNavTabs locale={locale} />
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("addRole")}</h1>
      </div>
      <form action={action} className="mx-auto grid w-full max-w-2xl gap-6 rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-8">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">{t("fields.key")}</label>
          <input name="key" placeholder="team_manager" pattern="[a-z0-9_]+" required className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/20" />
          <p className="text-xs leading-5 text-muted-foreground">{t("errors.keyFormat")}</p>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">{t("fields.name")}</label>
          <input name="name" required className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/20" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">{t("fields.description")}</label>
          <textarea name="description" rows={4} className="w-full resize-y rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/20" />
        </div>
        <div className="flex justify-center border-t border-border/60 pt-5">
          <Button type="submit" className="h-11 min-w-36 gap-2 rounded-xl px-6 shadow-sm"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
        </div>
      </form>
    </div>
  );
}
