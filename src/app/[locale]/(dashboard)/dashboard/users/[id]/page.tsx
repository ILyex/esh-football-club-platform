import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
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
import { KeyRound, Save, Trash2, UsersRound, Plus, X, BriefcaseBusiness } from "lucide-react";
import { SettingsNavTabs } from "@/components/settings/settings-nav-tabs";
import { userIdPrefixFromRoute } from "@/lib/user-route";
import { AvatarUploadField } from "@/components/users/avatar-upload-field";
import { FormSelect } from "@/components/ui/form-select";
import { localizedClubName } from "@/lib/public/locale-text";

export default async function UserDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requirePagePermission("users.manage", locale);
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
  const isSingleTeamCoach = user.role.key === "coach";

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
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            {locale === "ar" ? "تعديل / تحديث الصورة الشخصية" : "Mettre à jour la photo"}
          </label>
          <AvatarUploadField locale={locale} />
        </div>

        <div className="grid items-start gap-x-5 gap-y-5 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label htmlFor="user-name" className="block text-sm font-medium leading-5">{t("fields.name")}</label>
            <input id="user-name" name="name" defaultValue={user.name} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
          </div>
          <div className="min-w-0 space-y-2">
            <label htmlFor="user-email" className="block text-sm font-medium leading-5">{t("fields.email")}</label>
            <input id="user-email" name="email" type="email" defaultValue={user.email} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
          </div>
          <div className="min-w-0 space-y-2">
            <label className="block text-sm font-medium leading-5">{t("fields.role")}</label>
            <FormSelect
              name="roleId"
              locale={locale}
              ariaLabel={t("fields.role")}
              defaultValue={user.roleId}
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <span className="block text-sm font-medium leading-5">{locale === "ar" ? "حالة الحساب" : "Statut du compte"}</span>
            <label className="group flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 text-sm transition-colors hover:border-club-primary/50 hover:bg-club-primary/[0.03] focus-within:border-club-primary focus-within:ring-2 focus-within:ring-club-primary/15">
              <span className="flex items-center gap-2.5 font-medium text-foreground">
                <span className={`h-2.5 w-2.5 rounded-full ring-4 ${user.isActive ? "bg-emerald-500 ring-emerald-500/10" : "bg-zinc-400 ring-zinc-400/10"}`} aria-hidden="true" />
                {t("fields.isActive")}
              </span>
              <input type="hidden" name="isActive" value="false" />
              <input name="isActive" type="checkbox" defaultChecked={user.isActive} className="h-4 w-4 shrink-0 accent-club-primary" />
            </label>
          </div>
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
      <section className="overflow-visible rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-start justify-between gap-4 overflow-hidden rounded-t-2xl border-b border-border/80 bg-gradient-to-l from-club-primary/[0.08] via-card to-card px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary ring-1 ring-club-primary/15">
              <UsersRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground">{tTeam("title")}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{tTeam("userHint")}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
            <BriefcaseBusiness className="h-3.5 w-3.5 text-club-primary" aria-hidden="true" />
            {user.teamAssignments.length}
          </span>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {user.teamAssignments.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
              <UsersRound className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
              <span>{tTeam("noAssignments")}</span>
            </div>
          ) : (
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {user.teamAssignments.map((a) => {
                async function remove() {
                  "use server";
                  await removeUserTeamAction(id, a.teamId);
                }
                return (
                  <li key={a.teamId} className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border/80 bg-background px-3.5 py-2.5 transition-colors hover:border-club-primary/40 hover:bg-club-primary/[0.03]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" aria-hidden="true" />
                      <span className="truncate text-sm font-semibold text-foreground">{localizedClubName(a.team.name, locale, a.team.category)}</span>
                    </div>
                    <form action={remove}>
                      <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-600" aria-label={tCommon("remove")} title={tCommon("remove")}>
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}

          {unassignedTeams.length > 0 && !(isSingleTeamCoach && user.teamAssignments.length > 0) && (
            <form action={addTeam} className="rounded-xl border border-dashed border-club-primary/35 bg-club-primary/[0.035] p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-club-primary/10 text-club-primary">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>{tTeam("addTeam")}</span>
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <FormSelect
                    name="teamId"
                    locale={locale}
                    ariaLabel={tTeam("addTeam")}
                    options={unassignedTeams.map((team) => ({ value: team.id, label: localizedClubName(team.name, locale, team.category) }))}
                  />
                </div>
                <Button type="submit" className="h-10 shrink-0 gap-2 px-4">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {tTeam("assign")}
                </Button>
              </div>
            </form>
          )}

          {isSingleTeamCoach && user.teamAssignments.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "حساب المدرب مرتبط بفئة واحدة فقط. غيّر الفئة بإزالة الإسناد الحالي أولًا."
                : "Un compte entraîneur est limité à une seule catégorie. Retirez l’équipe actuelle avant d’en attribuer une autre."}
            </p>
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
        </div>
      </section>
    </div>
  );
}
