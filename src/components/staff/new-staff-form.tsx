"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DocumentUploadField } from "@/components/dashboard/document-upload-field";
import { toast } from "sonner";
import { User, Shield, Briefcase, FileText, AlertCircle, Loader2, UploadCloud, Image as ImageIcon } from "lucide-react";
import { FormSelect } from "@/components/ui/form-select";
import { IMAGE_UPLOAD_ACTION, IMAGE_UPLOAD_FRAME, IMAGE_UPLOAD_ICON } from "@/components/ui/image-upload-frame";

const ROLES = [
  "HEAD_COACH",
  "ASSISTANT_COACH",
  "GOALKEEPING_COACH",
  "FITNESS_COACH",
  "MEDICAL_STAFF",
  "ADMINISTRATIVE_STAFF",
  "OTHER"
] as const;

interface NewStaffFormProps {
  locale: string;
  createAction: (formData: FormData) => Promise<{ id: string; positiveDrugTestDetected?: boolean }>;
  roleTranslations: Record<string, string>;
  accountRoles: Array<{ id: string; key: string; name: string; teamScoped: boolean }>;
  teams: Array<{ id: string; label: string }>;
  canAssignUserAccess: boolean;
  commonSave: string;
}

export function NewStaffForm({
  locale,
  createAction,
  roleTranslations,
  accountRoles,
  teams,
  canAssignUserAccess,
  commonSave
}: NewStaffFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formEpoch, setFormEpoch] = useState(0);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);
  const isAr = locale === "ar";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await createAction(formData);
      toast.success(isAr ? "تمت إضافة عضو الطاقم بنجاح" : "Membre du staff ajouté avec succès");
      if (res.positiveDrugTestDetected) {
        toast.warning(
          isAr
            ? "تم حفظ وثيقة فحص المخدرات بسرية، لكن نتيجتها إيجابية وتحتاج إلى مراجعة عاجلة."
            : "Le test de dépistage a été conservé de façon confidentielle, mais le résultat est positif et doit être examiné immédiatement."
        );
      }
      form.reset();
      setPhotoPreview(null);
      setFormEpoch((epoch) => epoch + 1);
    } catch (err: any) {
      let rawMsg = err?.message || "";
      if (rawMsg.includes("categoryAlreadyHasHeadCoach")) {
        rawMsg = isAr ? "هذه الفئة لديها مدرب رئيسي بالفعل. اختر فئة أخرى أو عدّل ملف المدرب الحالي." : "Cette catégorie a déjà un entraîneur principal. Choisissez une autre catégorie ou modifiez sa fiche.";
      }
      if (rawMsg.includes("VERIFY_REJECT")) {
        const parts = rawMsg.split("|");
        rawMsg = parts[2] || parts[0];
      }
      setErrorMessage(rawMsg || (isAr ? "حدث خطأ أثناء حفظ البيانات" : "Une erreur est survenue lors de l'enregistrement"));
      toast.error(isAr ? "تعذّر حفظ بيانات العضو" : "Échec de l'enregistrement du membre");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form key={formEpoch} onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Personal & Civil Information (2-3 Col Grid) */}
      <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-2.5 border-b border-border/60 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {isAr ? "البيانات الشخصية والمدنية (باللغتين)" : "Informations personnelles & civiles"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr ? "الاسم واللقب بالعربية وبالفرنسية لضمان الطباعة الدقيقة في الوثائق" : "Nom et prénom en arabe et en français pour les documents officiels"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field
            label={isAr ? "الاسم (بالعربية)" : "Prénom (AR)"}
            name="firstName"
            required
            placeholder={isAr ? "مثال: عبد القادر" : "ex: Abdelkader"}
          />
          <Field
            label={isAr ? "اللقب (بالعربية)" : "Nom (AR)"}
            name="lastName"
            required
            placeholder={isAr ? "مثال: منصوري" : "ex: Mansouri"}
          />
          <Field
            label={isAr ? "الاسم (بالفرنسية)" : "Prénom (FR)"}
            name="firstNameFr"
            placeholder="ex: Abdelkader"
          />
          <Field
            label={isAr ? "اللقب (بالفرنسية)" : "Nom (FR)"}
            name="lastNameFr"
            placeholder="ex: Mansouri"
          />
          <Field
            label={isAr ? "رقم الرخصة" : "N° de licence"}
            name="licenceNumber"
            placeholder="26W14E..."
          />
          <Field label={isAr ? "تاريخ الميلاد" : "Date de naissance"} name="dateOfBirth" type="date" locale={locale} />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isAr ? "زمرة الدم" : "Groupe sanguin"}
            </label>
            <FormSelect
              name="bloodGroup"
              locale={locale}
              ariaLabel={isAr ? "زمرة الدم" : "Groupe sanguin"}
              options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((value) => ({ value, label: value }))}
              placeholder={isAr ? "اختر زمرة الدم" : "Choisir le groupe"}
            />
          </div>
        </div>
      </div>

      {/* 2. Operational Role & Contact (2-3 Col Grid) */}
      <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-2.5 border-b border-border/60 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Briefcase className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {isAr ? "المسمى المهني" : "Fonction professionnelle"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr ? "اختر الصفة والفئة لتكوين مسمى واحد واضح، مثل مدرب الأكابر." : "Choisissez la fonction et la catégorie pour former un intitulé unique."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-end">
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isAr ? "الصفة المهنية" : "Fonction"} <span className="text-red-500">*</span>
            </label>
            <FormSelect
              name="role"
              required
              locale={locale}
              ariaLabel={isAr ? "الصفة أو المنصب" : "Rôle"}
              defaultValue="HEAD_COACH"
              options={ROLES.map((role) => ({ value: role, label: roleTranslations[role] || role }))}
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "الفئة المهنية" : "Catégorie"}</label>
            <FormSelect
              name="teamId"
              locale={locale}
              ariaLabel={isAr ? "الفئة المهنية" : "Catégorie"}
              options={teams.map((team) => ({ value: team.id, label: team.label }))}
              placeholder={isAr ? "اختر فئة واحدة" : "Choisir une catégorie"}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">{isAr ? "فئة واحدة لكل عضو، ومدرب رئيسي واحد لكل فئة." : "Une seule catégorie par membre et un entraîneur principal par catégorie."}</p>
          </div>

          <div className="min-w-0">
            <Field
              label={isAr ? "بيانات التواصل المهني" : "Contact interne"}
              name="internalContact"
              placeholder={isAr ? "رقم الهاتف أو البريد المهني..." : "Téléphone ou email interne..."}
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isAr ? "الصورة الشخصية" : "Photo"}
            </label>
            <label className={`${IMAGE_UPLOAD_FRAME} min-h-11 cursor-pointer gap-2.5 px-3 py-2`}>
              <span className={`${IMAGE_UPLOAD_ICON} h-9 w-9 overflow-hidden rounded-full`}>
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                ) : <ImageIcon className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1 text-start">
                <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-foreground">
                  <UploadCloud className="h-4 w-4 text-club-primary" />
                  {isAr ? "اختر صورة شخصية" : "Choisir une photo"}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                  {photoPreview ? (isAr ? "تم اختيار الصورة" : "Photo sélectionnée") : (isAr ? "JPG أو PNG أو WebP — الحد الأقصى 5 ميغابايت" : "JPG, PNG ou WebP — 5 Mo maximum")}
                </span>
              </span>
              <span className={`${IMAGE_UPLOAD_ACTION} h-8 px-2.5 text-[11px]`}>{isAr ? "اختيار" : "Choisir"}</span>
              <input
                key={formEpoch}
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setPhotoPreview((previous) => {
                    if (previous) URL.revokeObjectURL(previous);
                    return URL.createObjectURL(file);
                  });
                }}
              />
            </label>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isAr ? "نبذة تعريفية ومؤهلات" : "Biographie & Parcours"}
          </label>
          <textarea
            name="biography"
            rows={3}
            placeholder={isAr ? "المسار المهني، الخبرات السابقة..." : "Parcours professionnel, expériences..."}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* 3. Official Documents & Drug Test (2-3 Col Grid) */}
      <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-2.5 border-b border-border/60 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {isAr ? "وثائق ومستندات المدرب / الطاقم الرسمية" : "Documents officiels du staff / entraîneur"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "ارفع الملفات الثبوتية الأربعة مع التحقق التلقائي من الهوية والفحص الطبي للمخدرات"
                : "Téléversez les justificatifs officiels avec contrôle automatisé et test de dépistage"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DocumentUploadField
            name="cniFile"
            label={isAr ? "بطاقة التعريف الوطنية (CNI)" : "Carte Nationale d'Identité (CNI)"}
            description={isAr ? "نسخة ممسوحة ضوئياً للبطاقة البيومترية" : "Copie numérisée de la carte biométrique"}
            locale={locale}
          />
          <DocumentUploadField
            name="contractFile"
            label={isAr ? "عقد العمل والاعتماد الرسمي" : "Contrat de travail & convention"}
            description={isAr ? "عقد العمل المعتمد والمبرم مع النادي" : "Contrat officiel de travail et d'accréditation"}
            locale={locale}
          />
          <DocumentUploadField
            name="diplomaFile"
            label={isAr ? "الشهادات والاعتمادات التدريبية" : "Diplômes & licences FAF / CAF"}
            description={isAr ? "شهادات التدريب الفدرالية (FAF, CAF, UEFA...)" : "Licences techniques et diplômes d'entraîneur"}
            locale={locale}
          />
          <DocumentUploadField
            name="drugTestFile"
            label={isAr ? "وثيقة تحليل المخدرات" : "Test de dépistage de drogues"}
            description={isAr ? "تقرير الفحص والتحاليل المخبرية للمواد الممنوعة" : "Rapport du contrôle médical de dépistage"}
            locale={locale}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs sm:p-6">
        <div className="mb-4 flex items-center gap-2.5 border-b border-border/60 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Shield className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{isAr ? "صلاحية حساب المنصة" : "Autorisation du compte"}</h2>
            <p className="text-xs text-muted-foreground">{isAr ? "هذه الصلاحية تحدد ما يستطيع الحساب فعله، وهي منفصلة عن المسمى المهني." : "Cette autorisation définit les accès du compte et reste distincte de la fonction professionnelle."}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {canAssignUserAccess && accountRoles.length > 0 ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "صلاحية حساب المنصة" : "Autorisation du compte"}</label>
              <FormSelect
                name="accountRoleId"
                locale={locale}
                ariaLabel={isAr ? "صلاحية حساب المنصة" : "Autorisation du compte"}
                defaultValue={accountRoles.find((role) => role.key === "viewer")?.id ?? accountRoles[0]?.id ?? ""}
                options={accountRoles.map((role) => ({ value: role.id, label: role.name }))}
              />
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
              {isAr ? "سيُنشأ الحساب بدور قراءة محدود، ويمكن لمدير المستخدمين تحديد الصلاحيات لاحقًا." : "Le compte sera créé avec le rôle de lecture seule. Un gestionnaire pourra ensuite ajuster ses autorisations."}
            </p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting} className="min-w-36 h-10 font-semibold">
          {isSubmitting ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              <span>{isAr ? "جاري الحفظ..." : "Enregistrement..."}</span>
            </>
          ) : (
            commonSave
          )}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
  locale
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  locale?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        name={name}
        type={type}
        lang={type === "date" ? (locale === "ar" ? "ar-DZ" : "fr-DZ") : undefined}
        dir={type === "date" ? "ltr" : undefined}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
