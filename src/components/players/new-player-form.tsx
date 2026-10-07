"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DocumentUploadField } from "@/components/dashboard/document-upload-field";
import { toast } from "sonner";
import { User, Shield, Activity, FileText, Image as ImageIcon, AlertCircle, Loader2, Save, UploadCloud, ImagePlus } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { FormSelect } from "@/components/ui/form-select";

interface TeamItem {
  id: string;
  category: string;
}

interface NewPlayerFormProps {
  locale: string;
  createAction: (formData: FormData) => Promise<{ id: string; positiveDrugTestDetected?: boolean }>;
  teams: TeamItem[];
  currentTeamId: string | null;
  translations: {
    nationality: string;
    dateOfBirth: string;
    birthCertificateNumber: string;
    team: string;
    position: string;
    preferredFoot: string;
    shirtNumber: string;
    previousTeam: string;
    joiningDate: string;
    height: string;
    weight: string;
    photo: string;
    biography: string;
    save: string;
  };
  teamCategoryTranslations: Record<string, string>;
  positionTranslations: Record<string, string>;
  footTranslations: Record<string, string>;
}

export function NewPlayerForm({
  locale,
  createAction,
  teams,
  currentTeamId,
  translations,
  teamCategoryTranslations,
  positionTranslations,
  footTranslations
}: NewPlayerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
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
      toast.success(isAr ? "تمت إضافة اللاعب بنجاح" : "Joueur ajouté avec succès");
      if (res.positiveDrugTestDetected) {
        toast.warning(
          isAr
            ? "تم حفظ وثيقة فحص المخدرات بسرية، لكن نتيجتها إيجابية وتحتاج إلى مراجعة عاجلة."
            : "Le test de dépistage a été conservé de façon confidentielle, mais le résultat est positif et doit être examiné immédiatement."
        );
      }
      form.reset();
      setSelectedPhoto(null);
      setFormEpoch((epoch) => epoch + 1);
    } catch (err: any) {
      let rawMsg = err?.message || "";
      if (rawMsg.includes("VERIFY_REJECT")) {
        const parts = rawMsg.split("|");
        rawMsg = parts[2] || parts[0];
      }
      setErrorMessage(rawMsg || (isAr ? "حدث خطأ أثناء حفظ بيانات اللاعب" : "Une erreur est survenue lors de l'enregistrement du joueur"));
      toast.error(isAr ? "تعذّر حفظ بيانات اللاعب" : "Échec de l'enregistrement du joueur");
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

      {/* 1. Personal & Civil Information */}
      <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-2.5 border-b border-border/60 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {isAr ? "البيانات الشخصية والمدنية" : "Informations personnelles & civiles"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr ? "الاسم الكامل، الجنسية وتاريخ الميلاد" : "Nom, prénom, nationalité et date de naissance"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label={isAr ? "الاسم (بالعربية)" : "Prénom (AR)"} name="firstName" required placeholder={isAr ? "مثال: كريم" : "ex: Karim"} />
          <Field label={isAr ? "اللقب (بالعربية)" : "Nom (AR)"} name="lastName" required placeholder={isAr ? "مثال: بن علي" : "ex: Benali"} />
          <Field label={isAr ? "الاسم (بالفرنسية)" : "Prénom (FR)"} name="firstNameFr" placeholder="ex: Karim" />
          <Field label={isAr ? "اللقب (بالفرنسية)" : "Nom (FR)"} name="lastNameFr" placeholder="ex: Benali" />
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label={translations.nationality} name="nationality" required defaultValue={isAr ? "جزائرية" : "Algérienne"} />
          <div>
            <DateInput
              label={translations.dateOfBirth}
              name="dateOfBirth"
              required
              locale={locale}
            />
          </div>
          <div>
            <Field label={translations.birthCertificateNumber} name="birthCertificateNumber" placeholder={isAr ? "رقم عقد الميلاد" : "N° acte de naissance"} />
          </div>
          <div>
            <Field label={isAr ? "رقم رخصة اللاعب" : "N° de licence du joueur"} name="licenceNumber" placeholder={isAr ? "مثال: 26/14589" : "ex: 26/14589"} />
          </div>
        </div>
      </div>

      {/* 2. Sporting & Team Profile */}
      <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-2.5 border-b border-border/60 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {isAr ? "البيانات الرياضية والفنية" : "Profil sportif & équipe"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr ? "الفريق الملحق به اللاعب، المركز ورقم القميص" : "Équipe d'affectation, poste et numéro de maillot"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {translations.team} <span className="text-red-500">*</span>
            </label>
            <FormSelect
              name="teamId"
              required
              locale={locale}
              defaultValue={currentTeamId ?? ""}
              ariaLabel={translations.team}
              options={teams.map((team) => ({ value: team.id, label: teamCategoryTranslations[team.category] || team.category }))}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {translations.position} <span className="text-red-500">*</span>
            </label>
            <FormSelect
              name="position"
              required
              locale={locale}
              ariaLabel={translations.position}
              defaultValue="GOALKEEPER"
              options={["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"].map((pos) => ({ value: pos, label: positionTranslations[pos] || pos }))}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {translations.preferredFoot}
            </label>
            <FormSelect
              name="preferredFoot"
              locale={locale}
              ariaLabel={translations.preferredFoot}
              placeholder="—"
              options={[{ value: "", label: "—" }, ...["RIGHT", "LEFT", "BOTH"].map((foot) => ({ value: foot, label: footTranslations[foot] || foot }))]}
            />
          </div>

          <Field label={translations.shirtNumber} name="shirtNumber" type="number" />
          <Field label={translations.previousTeam} name="previousTeam" />
          <DateInput
            label={translations.joiningDate}
            name="joiningDate"
            locale={locale}
          />
        </div>
      </div>

      {/* 3. Physical Attributes & Measurements */}
      <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-2.5 border-b border-border/60 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {isAr ? "القياسات البدنية" : "Mesures physiques"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr ? "الطول والوزن الأولي للاعب" : "Taille (cm) et poids (kg)"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={`${translations.height} (cm)`} name="height" type="number" min={120} max={230} step="1" />
          <Field label={`${translations.weight} (kg)`} name="weight" type="number" min={30} max={200} step="0.1" />
        </div>
      </div>

      {/* 4. Media & Biographies */}
      <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-2.5 border-b border-border/60 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {isAr ? "الصورة الشخصية والنبذة التعريفية" : "Photo & Biographies"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr ? "صورة اللاعب والسيرة الذاتية باللغتين العربية والفرنسية" : "Portrait du joueur et biographies (AR / FR)"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="new-player-photo" className="block text-xs font-semibold text-foreground">
              {translations.photo}
            </label>
            <input
              id="new-player-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="peer sr-only"
              onChange={(event) => setSelectedPhoto(event.currentTarget.files?.[0] ?? null)}
            />
            <label
              htmlFor="new-player-photo"
              className="group flex min-h-[76px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-background/70 px-3 py-3 transition-colors hover:border-club-primary/60 hover:bg-club-primary/5 peer-focus-visible:ring-2 peer-focus-visible:ring-club-primary/30 sm:px-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-club-primary/15 bg-club-primary/10 text-club-primary transition-colors group-hover:bg-club-primary/15">
                {selectedPhoto ? <ImagePlus className="h-5 w-5" aria-hidden="true" /> : <UploadCloud className="h-5 w-5" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {selectedPhoto?.name ?? (isAr ? "اختر صورة اللاعب من جهازك" : "Choisir la photo du joueur")}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {selectedPhoto
                    ? `${Math.max(1, Math.ceil(selectedPhoto.size / 1024))} KB`
                    : (isAr ? "PNG أو JPG أو WebP" : "PNG, JPG ou WebP")}
                </span>
              </span>
              <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-xs transition-colors group-hover:border-club-primary/30 group-hover:text-club-primary">
                <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {isAr ? "استعراض" : "Parcourir"}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {translations.biography} (AR)
              </label>
              <textarea
                name="biographyAr"
                dir="rtl"
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {translations.biography} (FR)
              </label>
              <textarea
                name="biographyFr"
                dir="ltr"
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Official Documents (CNI, Contract, Birth Certificate, Drug Test) */}
      <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-2.5 border-b border-border/60 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {isAr ? "وثائق ومستندات اللاعب الرسمية" : "Documents officiels du joueur"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "ارفع الملفات الثبوتية الأربعة مع التحقق الذكي التلقائي من هوية اللاعب"
                : "Téléversez les justificatifs officiels avec contrôle automatisé de concordance d'identité"}
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
            label={isAr ? "عقد اللاعب الرسمي" : "Contrat officiel du joueur"}
            description={isAr ? "العقد المبرم مع النادي والمختوم" : "Contrat signé et paraphé avec le club"}
            locale={locale}
          />
          <DocumentUploadField
            name="birthCertificateFile"
            label={isAr ? "شهادة الميلاد (عقد الميلاد)" : "Acte de naissance"}
            description={isAr ? "مستخرج ميلاد رسمي حديث" : "Extrait de naissance officiel récent"}
            locale={locale}
          />
          <DocumentUploadField
            name="drugTestFile"
            label={isAr ? "وثيقة فحص المخدرات" : "Test de dépistage de drogues"}
            description={isAr ? "تقرير الفحص الطبي والتحاليل المخبرية للمواد الممنوعة" : "Rapport du contrôle médical de dépistage"}
            locale={locale}
          />
        </div>
      </div>

      {/* Submit Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting} className="min-w-36 h-10 font-semibold">
          {isSubmitting ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              <span>{isAr ? "جاري الحفظ..." : "Enregistrement..."}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Save className="h-4 w-4" />
              <span>{translations.save}</span>
            </span>
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
  step,
  min,
  max,
  placeholder,
  defaultValue
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  step?: string;
  min?: number;
  max?: number;
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
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          if (min !== undefined && event.currentTarget.value.startsWith("-") && Number(event.currentTarget.value) < 0) {
            event.currentTarget.value = String(min);
          }
        }}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
