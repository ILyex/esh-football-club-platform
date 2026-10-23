import { Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsNavTabs } from "@/components/settings/settings-nav-tabs";

export default async function RolesListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("roles.manage", locale);
  const t = await getTranslations("roles");
  const tCommon = await getTranslations("common");

  const roles = await db.role.findMany({
    where: { key: { not: "staff_profile" } },
    include: { _count: { select: { users: { where: { deletedAt: null } }, permissions: true } } },
    orderBy: { name: "asc" }
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4">
      <SettingsNavTabs locale={locale} />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link href={`/${locale}/dashboard/roles/new`}>
          <Button className="inline-flex items-center gap-2"><Plus className="h-4 w-4 shrink-0" aria-hidden="true" />{t("addRole")}</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => (
          <Link key={role.id} href={`/${locale}/dashboard/roles/${role.id}`} className="block rounded-lg border border-border bg-card p-4">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-semibold">{role.name}</h2>
              {role.isSystem && <Badge tone="neutral">{t("systemRole")}</Badge>}
            </div>
            {role.description && <p className="mb-2 text-sm text-muted-foreground">{role.description}</p>}
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>
                {t("usersCount")}: {role._count.users}
              </span>
              <span>
                {t("fields.permissions")}: {role._count.permissions}
              </span>
            </div>
          </Link>
        ))}
        {roles.length === 0 && <p className="col-span-full text-sm text-muted-foreground">{tCommon("noResults")}</p>}
      </div>
    </div>
  );
}
