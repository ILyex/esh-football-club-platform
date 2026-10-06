import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import {
  updateUserAction,
  resetUserPasswordAction,
  addUserTeamAction,
  removeUserTeamAction,
  deleteUserPhotoAction
} from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Save, Trash2 } from "lucide-react";
import { SettingsNavTabs } from "@/components/settings/settings-nav-tabs";
import { userIdPrefixFromRoute } from "@/lib/user-route";

export default async function UserDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requirePermission("users.manage");
  const t = await getTranslations("users");
  const tTeam = await getTranslations("teamAssignments");
  const tCommon = await getTranslations("common");

  const prefix = userIdPrefixFromRoute(id);
  const [user, roles, allTeams] = await Promise.all([
    db.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { id },
          ...(prefix ? [{ id: { startsWith: prefix } }] : [])
        ]
      },
      include: {
        role: true,
        teamAssignments: { include: { team: true }, orderBy: { createdAt: "asc" } }
      }
    }),
    db.role.findMany({ orderBy: { name: "asc" } }),
    db.team.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ]);
  if (!user) notFound();
  const isOnline = user.isActive && user.lastSeenAt !== null && Date.now() - user.lastSeenAt.getTime() < 180_000;

  const assignedTeamIds = new Set(user.teamAssignments.map((a) => a.teamId));
  const unassignedTeams = allTeams.filter((t) => !assignedTeamIds.has(t.id));

  // Inline server wrappers required by Next.js for form actions that close
  // over `id` from params — they cannot be directly bound in JSX.
  async function update(formData: FormData) {
    "use server";
    await updateUserAction(id, formData);
  }
  async function removePhoto() {
    "use server";
    await deleteUserPhotoAction(id);
  }
  async function resetPassword(formData: FormData) {
    "use server";
    await resetUserPasswordAction(id, formData);
  }
  async function addTeam(formData: FormData) {
    "use server";
    await addUserTeamAction(id, formData);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <SettingsNavTabs locale={locale} />
      {/* ── User Avatar Header ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div className="relative group flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl overflow-hidden bg-club-primary/10 border border-club-primary/20 text-club-primary font-bold text-2xl">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt={user.name} className="h-full w-full object-cover" />
          ) : (
            <span>{user.name.charAt(0).toUpperCase()}</span>
          )}
        </div>

        <div className="flex-1 text-center sm:text-start space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{user.name}</h1>
            <Badge tone={isOnline ? "success" : "neutral"} className="gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
              {isOnline ? t("fields.online") : t("fields.offline")}
            </Badge>
            <Badge tone={user.isActive ? "success" : "danger"}>
              {user.isActive ? (locale === "ar" ? "الحساب مفعّل" : "Compte activé") : (locale === "ar" ? "الحساب معطّل" : "Compte désactivé")}
            </Badge>
            <Badge tone="neutral" className="text-[11px]">
              {user.role.name}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{user.email}</p>
          {user.lastLoginAt && (
            <p className="text-[11px] text-muted-foreground/80">
              {t("fields.lastLoginAt")}:{" "}
              {new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(user.lastLoginAt)}
            </p>
          )}

          {/* Delete Photo Button if photo exists */}
          {user.image && (
            <div className="pt-1 flex justify-center sm:justify-start">
              <form action={removePhoto}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1.5 px-2"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{locale === "ar" ? "حذف الصورة الشخصية" : "Supprimer la photo"}</span>
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <form action={update} encType="multipart/form-data" className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <div className="border-b border-border pb-3">
          <h2 className="text-base font-bold text-foreground">{locale === "ar" ? "البيانات الشخصية والصلاحيات" : "Profil et autorisations"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "حدّث معلومات الحساب والدور المرتبط به." : "Mettez à jour les informations et le rôle du compte."}</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {locale === "ar" ? "تعديل / تحديث الصورة الشخصية" : "Mettre à jour la photo"}
          </label>
          <input
            name="photo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="w-full text-xs file:me-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer rounded-md border border-border bg-background p-1.5"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {locale === "ar" ? "الصيغ المدعومة: PNG, JPG, WebP. الحجم الأقصى: 5 ميغابايت" : "Formats acceptés : PNG, JPG, WebP (max 5 Mo)"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">{t("fields.name")}</label>
            <input name="name" defaultValue={user.name} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">{t("fields.email")}</label>
            <input name="email" type="email" defaultValue={user.email} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">{t("fields.role")}</label>
            <select name="roleId" defaultValue={user.roleId} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15">
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm">
            <input name="isActive" type="checkbox" defaultChecked={user.isActive} className="h-4 w-4 accent-club-primary" /> {t("fields.isActive")}
          </label>
        </div>
        <div className="flex justify-end border-t border-border pt-4">
          <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
        </div>
      </form>

      {/* ── Password reset ───────────────────────────────────────────────── */}
      <form action={resetPassword} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"><KeyRound className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-bold">{t("resetPassword")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "سيتم إنهاء الجلسات الحالية بعد تغيير كلمة المرور." : "Les sessions en cours seront révoquées après la modification."}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input name="password" type="password" minLength={8} maxLength={72} required autoComplete="new-password" placeholder={t("fields.password")} className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
          <Button type="submit" variant="outline" className="h-10">{t("resetPassword")}</Button>
        </div>
      </form>

      {/* ── Team Assignments — P2 ────────────────────────────────────────── */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <div>
          <h2 className="text-sm font-semibold">{tTeam("title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{tTeam("userHint")}</p>
        </div>

        {/* Current assignments */}
        {user.teamAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tTeam("noAssignments")}</p>
        ) : (
          <ul className="space-y-2">
            {user.teamAssignments.map((a) => {
              async function remove() {
                "use server";
                await removeUserTeamAction(id, a.teamId);
              }
              return (
                <li key={a.teamId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span>{a.team.name}</span>
                  <form action={remove}>
                    <Button type="submit" variant="destructive" size="sm">
                      {tCommon("remove")}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        {/* Add assignment — only show if there are teams not yet assigned */}
        {unassignedTeams.length > 0 && (
          <form action={addTeam} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {tTeam("addTeam")}
              </label>
              <select
                name="teamId"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {unassignedTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">{tTeam("assign")}</Button>
          </form>
        )}

        {/* Contextual note about the role's team-scope setting */}
        {user.role.teamScoped ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {tTeam("teamScopedWarning")}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {tTeam("notTeamScopedNote")}
          </p>
        )}
      </section>
    </div>
  );
}
