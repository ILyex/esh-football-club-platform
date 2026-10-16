import { Save, Trash2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { updateRoleAction, updateRolePermissionsAction, deleteRoleAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RolePermissionsMatrix } from "@/components/roles/role-permissions-matrix";
import { SettingsNavTabs } from "@/components/settings/settings-nav-tabs";

export default async function RoleDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requirePagePermission("roles.manage", locale);
  const t = await getTranslations("roles");
  const tCommon = await getTranslations("common");

  const [role, allPermissions] = await Promise.all([
    db.role.findUnique({ where: { id }, include: { permissions: true, users: true } }),
    db.permission.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] })
  ]);
  if (!role) notFound();

  const visiblePermissions = allPermissions.filter((permission) => permission.key !== "*" || role.key === "super_admin");
  const grantedPermissionIds = new Set(role.permissions.map((rp) => rp.permissionId));

  async function update(formData: FormData) {
    "use server";
    await updateRoleAction(id, formData);
  }
  async function updatePermissions(formData: FormData) {
    "use server";
    const result = await updateRolePermissionsAction(id, formData);
    if (result.actorSessionWillBeRevoked) redirect(`/${locale}/login?permissionsUpdated=1`);
  }
  async function remove() {
    "use server";
    await deleteRoleAction(id);
    redirect(`/${locale}/dashboard/roles`);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <SettingsNavTabs locale={locale} />
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">{locale === "ar" ? "تعديل الصلاحيات" : "Modifier les autorisations"}</h1>
        {role.isSystem && <Badge tone="neutral">{t("systemRole")}</Badge>}
      </div>
      <p className="-mt-5 text-sm text-muted-foreground">{role.name}</p>

      <form action={update} className="grid gap-4 rounded-lg border border-border bg-card p-6">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.name")}</label>
          <input name="name" defaultValue={role.name} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.description")}</label>
          <textarea name="description" rows={2} defaultValue={role.description ?? ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
        </div>
      </form>

      <form action={updatePermissions} className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-foreground">{locale === "ar" ? `صلاحيات الدور: ${role.name}` : `Autorisations du rôle : ${role.name}`}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {locale === "ar"
                ? "حدد الصلاحيات الإدارية والفنية الممنوحة لهذا الدور بدقة عبر القطاعات المختلفة"
                : "Configurez les autorisations d'accès par secteur opérationnel"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!role.isSystem && role.users.length === 0 && (
              <ConfirmDialog onConfirm={remove}>
                <Button type="button" variant="destructive" className="gap-2 rounded-xl font-bold">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>{t("deleteRole")}</span>
                </Button>
              </ConfirmDialog>
            )}
            <Button type="submit" disabled={role.key === "super_admin"} className="gap-2"><Save className="h-4 w-4" /><span>{t("savePermissions")}</span></Button>
          </div>
        </div>

        <RolePermissionsMatrix
          allPermissions={visiblePermissions}
          grantedKeys={visiblePermissions.filter((p) => grantedPermissionIds.has(p.id)).map((p) => p.key)}
          locale={locale}
          isSystemRole={role.key === "super_admin"}
        />
      </form>
    </div>
  );
}
