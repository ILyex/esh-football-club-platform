"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DocumentUploadField } from "@/components/dashboard/document-upload-field";
import { toast } from "sonner";
import { User, Shield, Briefcase, FileText, AlertCircle, Loader2 } from "lucide-react";
import { FormSelect } from "@/components/ui/form-select";

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
  commonSave: string;
}

export function NewStaffForm({
  locale,
  createAction,
  roleTranslations,
  commonSave
}: NewStaffFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formEpoch, setFormEpoch] = useState(0);
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
      setFormEpoch((epoch) => epoch + 1);
    } catch (err: any) {
      let rawMsg = err?.message || "";
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
              {isAr ? "البيانات الشخصية والمدنية (باللغتين)" : "Informations personnelles & civiles (Bilingue)"}
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
              {isAr ? "الدور والوظيفة الإدارية / الفنية" : "Fonction opérationnelle & Contact"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr ? "تحديد المهمة داخل الطاقم وبيانات التواصل المهني" : "Rôle au sein du staff et coordonnées de contact"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isAr ? "الصفة / المنصب" : "Rôle"} <span className="text-red-500">*</span>
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

          <Field
            label={isAr ? "بيانات التواصل المهني" : "Contact interne"}
            name="internalContact"
            placeholder={isAr ? "رقم الهاتف أو البريد المهني..." : "Téléphone ou email interne..."}
          />

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isAr ? "الصورة الشخصية" : "Photo"}
            </label>
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-semibold file:text-foreground hover:file:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
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
  defaultValue
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
