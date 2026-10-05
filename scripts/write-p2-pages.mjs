// Write the P2 page files correctly using Node.js (avoids all PowerShell string encoding issues)
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ---------------------------------------------------------------------------
// users/[id]/page.tsx
// ---------------------------------------------------------------------------
const usersPagePath = join(
  root, "src", "app", "[locale]", "(dashboard)", "dashboard", "users", "[id]", "page.tsx"
);

const usersPageContent = `import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { updateUserAction, resetUserPasswordAction, addUserTeamAction, removeUserTeamAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function UserDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  await requirePermission("users.manage");
  const t = await getTranslations("users");
  const tTeam = await getTranslations("teamAssignments");
  const tCommon = await getTranslations("common");

  const [user, roles, allTeams] = await Promise.all([
    db.user.findUnique({
      where: { id },
      include: {
        role: true,
        teamAssignments: { include: { team: true }, orderBy: { createdAt: "asc" } }
      }
    }),
    db.role.findMany({ orderBy: { name: "asc" } }),
    db.team.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ]);
  if (!user) notFound();

  const assignedTeamIds = new Set(user.teamAssignments.map((a) => a.teamId));
  const unassignedTeams = allTeams.filter((t) => !assignedTeamIds.has(t.id));

  // Inline server wrappers required by Next.js for form actions that close
  // over \`id\` from params — they cannot be directly bound in JSX.
  async function update(formData: FormData) {
    "use server";
    await updateUserAction(id, formData);
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
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">{user.name}</h1>
        <Badge tone={user.isActive ? "success" : "danger"}>
          {user.isActive ? t("fields.isActive") : t("deactivate")}
        </Badge>
      </div>
      {user.lastLoginAt && (
        <p className="text-sm text-muted-foreground">
          {t("fields.lastLoginAt")}:{" "}
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(user.lastLoginAt)}
        </p>
      )}

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <form action={update} className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.name")}</label>
          <input name="name" defaultValue={user.name} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.email")}</label>
          <input name="email" type="email" defaultValue={user.email} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.role")}</label>
          <select name="roleId" defaultValue={user.roleId} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={user.isActive} /> {t("fields.isActive")}
        </label>
        <div className="col-span-2">
          <Button type="submit">{tCommon("save")}</Button>
        </div>
      </form>

      {/* ── Password reset ───────────────────────────────────────────────── */}
      <form action={resetPassword} className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold">{t("resetPassword")}</h2>
        <div className="flex items-end gap-2">
          <input
            name="password"
            type="password"
            minLength={8}
            required
            placeholder={t("fields.password")}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <Button type="submit" variant="outline">
            {t("resetPassword")}
          </Button>
        </div>
      </form>

      {/* ── Team Assignments — P2 ────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
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
`;

writeFileSync(usersPagePath, usersPageContent, "utf8");
console.log("✓ users/[id]/page.tsx written —", usersPageContent.split("\\n").length, "lines");

// ---------------------------------------------------------------------------
// staff/[id]/page.tsx
// ---------------------------------------------------------------------------
const staffPagePath = join(
  root, "src", "app", "[locale]", "(dashboard)", "dashboard", "staff", "[id]", "page.tsx"
);

const staffPageContent = `import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import {
  updateStaffAction,
  archiveStaffAction,
  hardDeleteStaffAction,
  addStaffTeamAction,
  removeStaffTeamAction
} from "../actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

const ROLES = [
  "HEAD_COACH",
  "ASSISTANT_COACH",
  "GOALKEEPING_COACH",
  "FITNESS_COACH",
  "MEDICAL_STAFF",
  "ADMINISTRATIVE_STAFF",
  "OTHER"
] as const;

export default async function StaffDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("staff.view");
  const t = await getTranslations("staff");
  const tTeam = await getTranslations("teamAssignments");
  const tCommon = await getTranslations("common");

  const canUpdate = hasPermission(user, "staff.update");
  const canDelete = hasPermission(user, "staff.delete");

  const [staff, allTeams] = await Promise.all([
    db.staff.findUnique({
      where: { id },
      include: {
        contracts: true,
        documents: true,
        teamAssignments: { include: { team: true }, orderBy: { createdAt: "asc" } }
      }
    }),
    db.team.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ]);
  if (!staff) notFound();

  const assignedTeamIds = new Set(staff.teamAssignments.map((a) => a.teamId));
  const unassignedTeams = allTeams.filter((t) => !assignedTeamIds.has(t.id));

  async function update(formData: FormData) {
    "use server";
    await updateStaffAction(id, formData);
  }
  async function archive() {
    "use server";
    await archiveStaffAction(id);
  }
  async function hardDelete() {
    "use server";
    await hardDeleteStaffAction(id);
  }
  async function addTeam(formData: FormData) {
    "use server";
    await addStaffTeamAction(id, formData);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">
        {staff.firstName} {staff.lastName}
      </h1>

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <form action={update} className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6">
        <Field label={t("fields.firstName")} name="firstName" defaultValue={staff.firstName} disabled={!canUpdate} />
        <Field label={t("fields.lastName")} name="lastName" defaultValue={staff.lastName} disabled={!canUpdate} />

        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.role")}</label>
          <select
            name="role"
            defaultValue={staff.role}
            disabled={!canUpdate}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(\`roles.\${r}\` as any)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{tCommon("status")}</label>
          <select
            name="status"
            defaultValue={staff.status}
            disabled={!canUpdate}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            {["ACTIVE", "INACTIVE", "ARCHIVED"].map((s) => (
              <option key={s} value={s}>
                {t(\`statuses.\${s}\` as any)}
              </option>
            ))}
          </select>
        </div>

        <Field
          label={t("fields.internalContact")}
          name="internalContact"
          defaultValue={staff.internalContact ?? ""}
          disabled={!canUpdate}
        />

        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.biography")}</label>
          <textarea
            name="biography"
            rows={3}
            defaultValue={staff.biography ?? ""}
            disabled={!canUpdate}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>

        {canUpdate && (
          <div className="col-span-2">
            <Button type="submit">{tCommon("save")}</Button>
          </div>
        )}
      </form>

      {/* ── Danger zone ──────────────────────────────────────────────────── */}
      {(canUpdate || canDelete) && (
        <div className="flex gap-2">
          {canUpdate && staff.status !== "ARCHIVED" && (
            <ConfirmDialog onConfirm={archive}>
              <Button variant="outline">{tCommon("delete")}</Button>
            </ConfirmDialog>
          )}
          {canDelete && (
            <ConfirmDialog onConfirm={hardDelete}>
              <Button variant="destructive">{tCommon("delete")}</Button>
            </ConfirmDialog>
          )}
        </div>
      )}

      {/* ── Team Assignments — Operational (P2) ─────────────────────────── */}
      {canUpdate && (
        <section className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">{tTeam("staffTitle")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{tTeam("staffHint")}</p>
          </div>

          {staff.teamAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tTeam("noAssignments")}</p>
          ) : (
            <ul className="space-y-2">
              {staff.teamAssignments.map((a) => {
                async function remove() {
                  "use server";
                  await removeStaffTeamAction(id, a.teamId);
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
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  disabled
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        disabled={disabled}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
      />
    </div>
  );
}
`;

writeFileSync(staffPagePath, staffPageContent, "utf8");
console.log("✓ staff/[id]/page.tsx written —", staffPageContent.split("\\n").length, "lines");
