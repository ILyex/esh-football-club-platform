import { Save, Trash2, Archive, RotateCcw, UsersRound, Plus, X, BriefcaseBusiness } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import {
  updateStaffAction,
  archiveStaffAction,
  restoreStaffAction,
  hardDeleteStaffAction,
  addStaffTeamAction,
  removeStaffTeamAction
} from "../actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DocumentUploadField } from "@/components/dashboard/document-upload-field";
import { FormSelect } from "@/components/ui/form-select";
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
  const user = await requirePagePermission("staff.view", locale);
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
  async function restore() {
    "use server";
    await restoreStaffAction(id);
  }
  async function hardDelete() {
    "use server";
    await hardDeleteStaffAction(id);
    redirect(`/${locale}/dashboard/staff`);
  }
  async function addTeam(formData: FormData) {
    "use server";
    await addStaffTeamAction(id, formData);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-7">
      <header className="border-b border-border/70 pb-5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {locale === "ar" ? "تعديل معلومات الطاقم" : "Modifier les informations du staff"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{getPlayerDisplayName(staff, locale)}</p>
      </header>

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <form id="staff-update-form" action={update} className="mx-auto grid w-full grid-cols-1 gap-x-6 gap-y-5 rounded-2xl border border-border bg-card p-5 text-center shadow-sm sm:p-7 md:grid-cols-2">
        <div className="col-span-1 border-b border-border/70 pb-3 text-start md:col-span-2">
          <h2 className="text-base font-bold">{locale === "ar" ? "البيانات الشخصية" : "Informations personnelles"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "حدّث الاسم والهوية المهنية لعضو الطاقم." : "Mettez à jour l’identité professionnelle du membre."}</p>
        </div>
        <Field label={locale === "ar" ? "الاسم (بالعربية)" : "Prénom (AR)"} name="firstName" defaultValue={staff.firstName} disabled={!canUpdate} />
        <Field label={locale === "ar" ? "اللقب (بالعربية)" : "Nom (AR)"} name="lastName" defaultValue={staff.lastName} disabled={!canUpdate} />
        <Field label={locale === "ar" ? "الاسم (بالفرنسية)" : "Prénom (FR)"} name="firstNameFr" defaultValue={staff.firstNameFr ?? ""} disabled={!canUpdate} />
        <Field label={locale === "ar" ? "اللقب (بالفرنسية)" : "Nom (FR)"} name="lastNameFr" defaultValue={staff.lastNameFr ?? ""} disabled={!canUpdate} />

        <div className="col-span-1 mt-2 border-b border-border/70 pb-3 text-start md:col-span-2">
          <h2 className="text-base font-bold">{locale === "ar" ? "الدور والبيانات المهنية" : "Fonction et informations professionnelles"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "حدّد المهمة والحالة وبيانات التواصل والصورة الشخصية." : "Définissez le rôle, le statut, le contact et la photo."}</p>
        </div>

        <div className="col-span-1 grid gap-4 md:col-span-2 md:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-semibold">{t("fields.role")}</label>
            <div className="min-h-11">
              <FormSelect
                name="role"
                defaultValue={staff.role}
                disabled={!canUpdate}
                locale={locale}
                ariaLabel={t("fields.role")}
                options={ROLES.map((r) => ({ value: r, label: t(`roles.${r}` as any) }))}
              />
            </div>
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-semibold">{tCommon("status")}</label>
            <div className="min-h-11">
              <FormSelect
                name="status"
                defaultValue={staff.status}
                disabled={!canUpdate}
                locale={locale}
                ariaLabel={tCommon("status")}
                options={["ACTIVE", "INACTIVE", "ARCHIVED"].map((s) => ({ value: s, label: t(`statuses.${s}` as any) }))}
              />
            </div>
          </div>

          <div className="min-w-0">
            <Field
              label={t("fields.internalContact")}
              name="internalContact"
              defaultValue={staff.internalContact ?? ""}
              disabled={!canUpdate}
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-semibold">{t("fields.photo")}</label>
            <label className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-club-primary/40 bg-club-primary/[0.04] px-3 py-2 transition hover:border-club-primary hover:bg-club-primary/[0.08] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
              {staff.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={staff.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full border border-border object-cover" />
              ) : (
                <span className="h-10 w-10 shrink-0 rounded-full border border-border bg-background" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {locale === "ar" ? "اختر صورة جديدة" : "Choisir une nouvelle photo"}
              </span>
              <span className="shrink-0 rounded-lg bg-club-primary px-3 py-1.5 text-xs font-semibold text-white">{locale === "ar" ? "اختيار" : "Choisir"}</span>
              <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={!canUpdate} className="sr-only" />
            </label>
          </div>
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold">{t("fields.biography")}</label>
          <textarea
            name="biography"
            rows={3}
            defaultValue={staff.biography ?? ""}
            disabled={!canUpdate}
            className="min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-7 outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/20 disabled:opacity-60"
          />
        </div>

        {(canUpdate || canDelete) && (
          <div className="col-span-1 md:col-span-2">
            <div className="flex flex-wrap items-center justify-start gap-2.5 border-t border-border/70 pt-5 md:justify-end" dir={locale === "ar" ? "rtl" : "ltr"}>
              {canUpdate && <Button type="submit" className="inline-flex h-10 min-w-36 items-center justify-center gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"><Save className="h-4 w-4 shrink-0" /><span>{tCommon("save")}</span></Button>}
              {canUpdate && (
                staff.status === "ARCHIVED" ? (
                  <ConfirmDialog
                    title={locale === "ar" ? "إرجاع عضو الطاقم إلى القائمة النشطة؟" : "Restaurer ce membre du staff ?"}
                    body={locale === "ar" ? "سيعود عضو الطاقم إلى الحالة النشطة وسيظهر مجددًا ضمن الطاقم الحالي." : "Ce membre repassera au statut actif et réapparaîtra dans le staff courant."}
                    onConfirm={restore}
                  >
                    <Button type="button" className="inline-flex h-10 min-w-40 items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700">
                      <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {locale === "ar" ? "إرجاع عضو الطاقم" : "Restaurer le membre"}
                    </Button>
                  </ConfirmDialog>
                ) : (
                  <ConfirmDialog
                    title={locale === "ar" ? "أرشفة عضو الطاقم؟" : "Archiver ce membre ?"}
                    body={locale === "ar" ? "سيختفي عضو الطاقم من القوائم النشطة مع الاحتفاظ بملفه وسجلاته، ويمكن إرجاعه لاحقًا." : "Ce membre sera retiré des listes actives, tout en conservant son dossier et son historique."}
                    onConfirm={archive}
                  >
                    <Button type="button" className="inline-flex h-10 min-w-40 items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700">
                      <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {locale === "ar" ? "أرشفة عضو الطاقم" : "Archiver le membre"}
                    </Button>
                  </ConfirmDialog>
                )
              )}
              {canDelete && (
                <ConfirmDialog
                  title={locale === "ar" ? "حذف عضو الطاقم نهائيًا؟" : "Supprimer définitivement ce membre du staff ?"}
                  body={locale === "ar" ? "سيتم حذف سجل عضو الطاقم نهائيًا ولا يمكن التراجع عن هذا الإجراء." : "La fiche de ce membre du staff sera supprimée définitivement. Cette action est irréversible."}
                  onConfirm={hardDelete}
                >
                  <Button type="button" size="icon" variant="destructive" className="h-10 w-10 shrink-0 bg-red-600 text-white hover:bg-red-700" aria-label={locale === "ar" ? "حذف عضو الطاقم نهائيًا" : "Supprimer définitivement ce membre"} title={locale === "ar" ? "حذف نهائي" : "Suppression définitive"}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </ConfirmDialog>
              )}
            </div>
          </div>
        )}
      </form>

      {/* ── Team Assignments — Operational (P2) ─────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-border/80 bg-gradient-to-l from-club-primary/[0.08] via-card to-card px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary ring-1 ring-club-primary/15">
                <UsersRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">{tTeam("staffTitle")}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{tTeam("staffHint")}</p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
              <BriefcaseBusiness className="h-3.5 w-3.5 text-club-primary" aria-hidden="true" />
              {staff.teamAssignments.length}
            </span>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            {staff.teamAssignments.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                <UsersRound className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                <span>{tTeam("noAssignments")}</span>
              </div>
            ) : (
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {staff.teamAssignments.map((a) => {
                  async function remove() {
                    "use server";
                    await removeStaffTeamAction(id, a.teamId);
                  }
                  return (
                    <li key={a.teamId} className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border/80 bg-background px-3.5 py-2.5 transition-colors hover:border-club-primary/40 hover:bg-club-primary/[0.03]">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" aria-hidden="true" />
                        <span className="truncate text-sm font-semibold text-foreground">{a.team.name}</span>
                      </div>
                      {canUpdate && (
                        <form action={remove}>
                          <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-600" aria-label={tCommon("remove")} title={tCommon("remove")}>
                            <X className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {canUpdate && unassignedTeams.length > 0 && (
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
                      defaultValue={unassignedTeams[0]?.id ?? ""}
                      options={unassignedTeams.map((team) => ({ value: team.id, label: team.name }))}
                    />
                  </div>
                  <Button type="submit" className="h-10 shrink-0 gap-2 px-4">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {tTeam("assign")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </section>

      {/* Documents remain part of the profile form via formId, below team assignments for quicker access. */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
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
              formId="staff-update-form"
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
              formId="staff-update-form"
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
              formId="staff-update-form"
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

      </div>
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
      {label && <label className="mb-1.5 block text-sm font-semibold">{label}</label>}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/20 disabled:opacity-60"
      />
    </div>
  );
}
