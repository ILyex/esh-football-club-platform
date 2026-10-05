import { Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
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
import { DocumentUploadField } from "@/components/dashboard/document-upload-field";
import { getPlayerDisplayName } from "@/lib/utils";

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
  const { locale, id } = await params;
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

  const cniDoc = staff.documents.find(
    (d) =>
      d.name.includes("بطاقة التعريف") ||
      d.name.toLowerCase().includes("cni") ||
      d.name.toLowerCase().includes("identite")
  );
  const contractDoc = staff.documents.find(
    (d) =>
      d.name.includes("عقد") ||
      d.name.toLowerCase().includes("contract") ||
      d.name.toLowerCase().includes("contrat")
  );
  const diplomaDoc = staff.documents.find(
    (d) =>
      d.name.includes("الشهادات") ||
      d.name.includes("مؤهل") ||
      d.name.toLowerCase().includes("diplom") ||
      d.name.toLowerCase().includes("licence")
  );

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
        {getPlayerDisplayName(staff, locale)}
      </h1>

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <form action={update} className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 sm:p-6 shadow-xs">
        <Field label={locale === "ar" ? "الاسم (بالعربية)" : "Prénom (AR)"} name="firstName" defaultValue={staff.firstName} disabled={!canUpdate} />
        <Field label={locale === "ar" ? "اللقب (بالعربية)" : "Nom (AR)"} name="lastName" defaultValue={staff.lastName} disabled={!canUpdate} />
        <Field label={locale === "ar" ? "الاسم (بالفرنسية)" : "Prénom (FR)"} name="firstNameFr" defaultValue={staff.firstNameFr ?? ""} disabled={!canUpdate} />
        <Field label={locale === "ar" ? "اللقب (بالفرنسية)" : "Nom (FR)"} name="lastNameFr" defaultValue={staff.lastNameFr ?? ""} disabled={!canUpdate} />

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
                {t(`roles.${r}` as any)}
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
                {t(`statuses.${s}` as any)}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-1 md:col-span-2">
          <Field
            label={t("fields.internalContact")}
            name="internalContact"
            defaultValue={staff.internalContact ?? ""}
            disabled={!canUpdate}
          />
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.photo")}</label>
          <div className="flex items-center gap-4">
            {staff.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={staff.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover border border-border shrink-0" />
            )}
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!canUpdate}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-semibold file:text-foreground hover:file:bg-muted/80 disabled:opacity-60"
            />
          </div>
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.biography")}</label>
          <textarea
            name="biography"
            rows={3}
            defaultValue={staff.biography ?? ""}
            disabled={!canUpdate}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>

        {/* Official Staff Documents Section */}
        <div className="col-span-1 md:col-span-2 pt-4 border-t border-border/80">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">
              {locale === "ar" ? "وثائق ومستندات المدرب / الطاقم الرسمية" : "Documents officiels du staff / entraîneur"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {locale === "ar"
                ? "الملفات الثبوتية المسجلة (بطاقة التعريف، عقد العمل، الشهادات والمؤهلات) مع المعاينة والتحميل والتحديث"
                : "Justificatifs officiels du staff avec prévisualisation, téléchargement et mise à jour"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <DocumentUploadField
              name="cniFile"
              label={locale === "ar" ? "بطاقة التعريف الوطنية (CNI)" : "Carte Nationale d'Identité (CNI)"}
              description={locale === "ar" ? "نسخة ممسوحة ضوئياً للبطاقة البيومترية" : "Copie numérisée de la carte biométrique"}
              locale={locale}
              existingDocument={cniDoc ? {
                id: cniDoc.id,
                name: cniDoc.name,
                mimeType: cniDoc.mimeType,
                originalName: cniDoc.originalName,
                sizeBytes: cniDoc.sizeBytes
              } : null}
            />
            <DocumentUploadField
              name="contractFile"
              label={locale === "ar" ? "عقد العمل والاعتماد الرسمي" : "Contrat de travail & convention"}
              description={locale === "ar" ? "عقد العمل المعتمد مع النادي" : "Contrat officiel de travail et d'accréditation"}
              locale={locale}
              existingDocument={contractDoc ? {
                id: contractDoc.id,
                name: contractDoc.name,
                mimeType: contractDoc.mimeType,
                originalName: contractDoc.originalName,
                sizeBytes: contractDoc.sizeBytes
              } : null}
            />
            <DocumentUploadField
              name="diplomaFile"
              label={locale === "ar" ? "الشهادات والاعتمادات التدريبية" : "Diplômes & licences FAF / CAF"}
              description={locale === "ar" ? "شهادات التدريب الفدرالية (FAF, CAF, UEFA...)" : "Licences techniques et diplômes d'entraîneur"}
              locale={locale}
              existingDocument={diplomaDoc ? {
                id: diplomaDoc.id,
                name: diplomaDoc.name,
                mimeType: diplomaDoc.mimeType,
                originalName: diplomaDoc.originalName,
                sizeBytes: diplomaDoc.sizeBytes
              } : null}
            />
          </div>
        </div>

        {canUpdate && (
          <div className="col-span-1 md:col-span-2">
            <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
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
