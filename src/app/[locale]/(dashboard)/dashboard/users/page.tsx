import { Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { hasPermission, isProgrammer, requirePagePermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsNavTabs } from "@/components/settings/settings-nav-tabs";
import { UserListActions } from "@/components/users/user-list-actions";
import { UsersPresenceRefresh } from "@/components/users/users-presence-refresh";
import { userDetailsHref } from "@/lib/user-route";

export default async function UsersListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const currentUser = await requirePagePermission("users.view", locale);
  const canTerminateSessions = hasPermission(currentUser, "users.manage") && isProgrammer(currentUser);
  const t = await getTranslations("users");
  const tCommon = await getTranslations("common");

  const users = await db.user.findMany({
    where: { deletedAt: null },
    include: { role: true },
    orderBy: { createdAt: "desc" }
  });
  const now = Date.now();

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4">
      <SettingsNavTabs locale={locale} />
      <UsersPresenceRefresh />
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "إدارة حسابات الدخول وحالة اتصال المستخدمين" : "Gérez les comptes et leur présence sur la plateforme."}</p>
        </div>
        <Link href={`/${locale}/dashboard/users/new`} className="self-start sm:self-auto">
          <Button className="inline-flex items-center gap-2"><Plus className="h-4 w-4 shrink-0" aria-hidden="true" />{t("addUser")}</Button>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">{t("fields.name")}</th>
              <th className="px-4 py-3 text-start font-semibold">{t("fields.email")}</th>
              <th className="px-4 py-3 text-center font-semibold">{t("fields.role")}</th>
              <th className="px-4 py-3 text-center font-semibold">{t("fields.sessionStatus")}</th>
              <th className="px-4 py-3 text-center font-semibold">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden bg-primary/10 border border-primary/20 text-primary font-semibold text-xs shadow-inner">
                      {u.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.image} alt={u.name} className="h-full w-full object-cover" />
                      ) : (
                        <span>{u.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="font-medium text-foreground">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3 text-center">
                  <Badge tone="neutral" className="text-xs">{u.role.name}</Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  {(() => {
                    const isOnline = u.isActive && u.lastSeenAt !== null && now - u.lastSeenAt.getTime() < 180_000;
                    return <Badge tone={isOnline ? "success" : "neutral"} className="gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                    {isOnline ? t("fields.online") : t("fields.offline")}
                  </Badge>
                  })()}
                </td>
                <td className="px-4 py-3 text-center">
                  <UserListActions
                    userId={u.id}
                    userName={u.name}
                    locale={locale}
                    deleteLabel={t("deleteUser")}
                    editLabel={tCommon("edit")}
                    confirmMessage={t("confirmDeleteUser")}
                    canTerminateSession={canTerminateSessions && currentUser.id !== u.id && u.isActive}
                    terminateSessionLabel={t("terminateSession")}
                    confirmTerminateSession={t("confirmTerminateSession")}
                    cancelLabel={tCommon("cancel")}
                  />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {tCommon("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
