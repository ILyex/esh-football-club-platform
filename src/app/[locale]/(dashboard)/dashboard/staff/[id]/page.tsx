import { Save, Trash2, Archive, RotateCcw } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import {
  updateStaffAction,
  archiveStaffAction,
  restoreStaffAction,
  hardDeleteStaffAction
} from "../actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DocumentUploadField } from "@/components/dashboard/document-upload-field";
import { FormSelect } from "@/components/ui/form-select";
import { StaffPhotoUploadField } from "@/components/staff/staff-photo-upload-field";
import { getPlayerDisplayName } from "@/lib/utils";
import Link from "next/link";

const ROLES = [
  "HEAD_COACH",
  "ASSISTANT_COACH",
  "GOALKEEPING_COACH",
  "FITNESS_COACH",
  "MEDICAL_STAFF",
  "ADMINISTRATIVE_STAFF",
  "OTHER"
] as const;

export default async function StaffDetailPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ staffSave?: string }> }) {
  const { locale, id } = await params;
  const { staffSave } = await searchParams;
  const user = await requirePagePermission("staff.view", locale);
  const t = await getTranslations("staff");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const canUpdate = hasPermission(user, "staff.update");
  const canDelete = hasPermission(user, "staff.delete");
  const canAssignUserAccess = hasPermission(user, "users.manage");

  const [staff, allTeams, allRoles] = await Promise.all([
    db.staff.findUnique({
      where: { id },
      include: {
        contracts: true,
        documents: true,
        user: { select: { id: true, roleId: true, email: true, isActive: true } },
        team: { select: { category: true } }
      }
    }),
    db.team.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, key: true, name: true } })
  ]);
  if (!staff) notFound();
  const accountRoles = allRoles.filter((role) => !["super_admin", "treasurer", "staff_profile"].includes(role.key));

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
    try {
      await updateStaffAction(id, formData);
    } catch (error) {
      console.error("Staff profile update failed", { staffId: id, error });
      const reason = error instanceof Error && error.message.includes("categoryAlreadyHasHeadCoach") ? "coachAssigned" : "error";
      redirect(`/${locale}/dashboard/staff/${id}?staffSave=${reason}`);
    }
    redirect(`/${locale}/dashboard/staff/${id}?staffSave=success`);
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
  return (
    <div className="mx-auto w-full max-w-4xl space-y-7">
      <header className="border-b border-border/70 pb-5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {locale === "ar" ? "تعديل معلومات الطاقم" : "Modifier les informations du staff"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{getPlayerDisplayName(staff, locale)}</p>
        <p className="mt-1 text-xs font-semibold text-club-primary">
          {[t(`roles.${staff.role}` as any), staff.team ? tTeams(`categories.${staff.team.category}` as any) : null].filter(Boolean).join(locale === "ar" ? " " : " — ")}
        </p>
      </header>

      {staffSave && (
        <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${staffSave === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"}`}>
          {staffSave === "success"
            ? (locale === "ar" ? "تم حفظ بيانات عضو الطاقم بنجاح." : "Les informations du membre du staff ont été enregistrées.")
            : staffSave === "coachAssigned"
              ? (locale === "ar" ? "هذه الفئة لديها مدرب رئيسي بالفعل. اختر فئة أخرى أو عدّل ملف المدرب الحالي." : "Cette catégorie a déjà un entraîneur principal. Choisissez une autre catégorie ou modifiez sa fiche.")
              : (locale === "ar" ? "تعذر حفظ كل التغييرات. أعد تحميل الصفحة وراجع البيانات أو الملفات ثم حاول مجددًا." : "Certaines modifications n’ont pas pu être enregistrées. Rechargez la page, vérifiez les données ou les fichiers, puis réessayez.")}
        </div>
      )}

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <form id="staff-update-form" action={update} className="mx-auto grid w-full grid-cols-1 gap-x-6 gap-y-5 rounded-2xl border border-border bg-card p-5 text-center shadow-sm sm:p-7 md:grid-cols-2">
        <input type="hidden" name="recordUpdatedAt" value={staff.updatedAt.toISOString()} />
        <div className="col-span-1 border-b border-border/70 pb-3 text-start md:col-span-2">
          <h2 className="text-base font-bold">{locale === "ar" ? "البيانات الشخصية" : "Informations personnelles"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "حدّث الاسم والهوية المهنية لعضو الطاقم." : "Mettez à jour l’identité professionnelle du membre."}</p>
        </div>
        <Field label={locale === "ar" ? "الاسم (بالعربية)" : "Prénom (AR)"} name="firstName" defaultValue={staff.firstName} disabled={!canUpdate} />
        <Field label={locale === "ar" ? "اللقب (بالعربية)" : "Nom (AR)"} name="lastName" defaultValue={staff.lastName} disabled={!canUpdate} />
        <Field label={locale === "ar" ? "الاسم (بالفرنسية)" : "Prénom (FR)"} name="firstNameFr" defaultValue={staff.firstNameFr ?? ""} disabled={!canUpdate} />
        <Field label={locale === "ar" ? "اللقب (بالفرنسية)" : "Nom (FR)"} name="lastNameFr" defaultValue={staff.lastNameFr ?? ""} disabled={!canUpdate} />
        <Field label={locale === "ar" ? "رقم الرخصة" : "N° de licence"} name="licenceNumber" defaultValue={staff.licenceNumber ?? ""} disabled={!canUpdate} />
        <Field label={locale === "ar" ? "تاريخ الميلاد" : "Date de naissance"} name="dateOfBirth" type="date" locale={locale} defaultValue={staff.dateOfBirth?.toISOString().slice(0, 10) ?? ""} disabled={!canUpdate} />
        <div className="min-w-0">
          <label className="mb-1.5 block text-sm font-semibold">{locale === "ar" ? "زمرة الدم" : "Groupe sanguin"}</label>
          <FormSelect name="bloodGroup" locale={locale} ariaLabel={locale === "ar" ? "زمرة الدم" : "Groupe sanguin"} defaultValue={staff.bloodGroup ?? ""} disabled={!canUpdate} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((value) => ({ value, label: value }))} placeholder={locale === "ar" ? "اختر زمرة الدم" : "Choisir le groupe"} />
        </div>

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

          <div className="col-span-1 min-w-0 md:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold">{locale === "ar" ? "الفئة المهنية" : "Catégorie professionnelle"}</label>
            <FormSelect
              name="teamId"
              defaultValue={staff.teamId ?? ""}
              disabled={!canUpdate || (Boolean(staff.user) && !canAssignUserAccess)}
              locale={locale}
              ariaLabel={locale === "ar" ? "الفئة المهنية" : "Catégorie professionnelle"}
              options={allTeams.map((team) => ({ value: team.id, label: tTeams(`categories.${team.category}` as any) }))}
              placeholder={locale === "ar" ? "اختر فئة واحدة" : "Choisir une catégorie"}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">{locale === "ar" ? "هذه الفئة مع الصفة المهنية تحدد مهمة العضو. يمكن ربطه بفئة واحدة فقط، ولكل فئة مدرب رئيسي واحد." : "La catégorie et la fonction définissent ensemble le poste. Un seul entraîneur principal est autorisé par catégorie."}</p>
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-semibold">{locale === "ar" ? "صلاحية حساب المنصة" : "Autorisation du compte"}</label>
            <FormSelect
              name="accountRoleId"
              defaultValue={staff.accountRoleId ?? staff.user?.roleId ?? accountRoles.find((role) => role.key === "viewer")?.id ?? ""}
              disabled={!canUpdate || !canAssignUserAccess}
              locale={locale}
              ariaLabel={locale === "ar" ? "صلاحية حساب المنصة" : "Autorisation du compte"}
              options={accountRoles.map((role) => ({ value: role.id, label: role.name }))}
            />
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
            <StaffPhotoUploadField currentPhotoUrl={staff.photoUrl} locale={locale} disabled={!canUpdate} />
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

      </form>

      {staff.user && (
        <aside className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-club-primary/20 bg-club-primary/[0.04] px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {locale === "ar" ? `حساب المستخدم المرتبط: ${staff.user.email}${staff.user.isActive ? " · مفعّل" : " · معطّل حتى تعيين البريد وكلمة المرور"}` : `Compte associé : ${staff.user.email}${staff.user.isActive ? " · actif" : " · inactif jusqu’à la définition des identifiants"}`}
          </span>
          <Link href={`/${locale}/dashboard/users/${staff.user.id}`} className="font-semibold text-club-primary hover:underline">
            {locale === "ar" ? "إدارة البريد وكلمة المرور" : "Gérer l’e-mail et le mot de passe"}
          </Link>
        </aside>
      )}

      {/* Documents remain part of the profile form via formId. */}
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

      {(canUpdate || canDelete) && (
        <div className="sticky bottom-3 z-20 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md sm:p-4">
          <div className="flex flex-wrap items-center justify-start gap-2.5" dir={locale === "ar" ? "rtl" : "ltr"}>
            {canUpdate && <Button type="submit" form="staff-update-form" className="inline-flex h-10 min-w-36 items-center justify-center gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"><Save className="h-4 w-4 shrink-0" /><span>{tCommon("save")}</span></Button>}
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
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  locale,
  defaultValue,
  disabled
}: {
  label: string;
  name: string;
  type?: string;
  locale?: string;
  defaultValue?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      {label && <label className="mb-1.5 block text-sm font-semibold">{label}</label>}
      <input
        name={name}
        type={type}
        lang={type === "date" ? (locale === "ar" ? "ar-DZ" : "fr-DZ") : undefined}
        dir={type === "date" ? "ltr" : undefined}
        defaultValue={defaultValue}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/20 disabled:opacity-60"
      />
    </div>
  );
}
