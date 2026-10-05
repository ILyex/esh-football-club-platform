import { Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/permissions";
import { createRoleAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SettingsNavTabs } from "@/components/settings/settings-nav-tabs";

export default async function NewRolePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePermission("roles.manage");
  const t = await getTranslations("roles");
  const tCommon = await getTranslations("common");

  async function action(formData: FormData) {
    "use server";
    const { id } = await createRoleAction(formData);
    redirect(`/${locale}/dashboard/roles/${id}`);
  }

  return (
    <div className="max-w-4xl space-y-4">
      <SettingsNavTabs locale={locale} />
      <h1 className="mb-4 text-xl font-semibold">{t("addRole")}</h1>
      <form action={action} className="grid gap-4 rounded-lg border border-border bg-card p-6">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.key")}</label>
          <input name="key" placeholder="team_manager" pattern="[a-z0-9_]+" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <p className="mt-1 text-xs text-muted-foreground">{t("errors.keyFormat")}</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.name")}</label>
          <input name="name" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.description")}</label>
          <textarea name="description" rows={2} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
        </div>
      </form>
    </div>
  );
}
