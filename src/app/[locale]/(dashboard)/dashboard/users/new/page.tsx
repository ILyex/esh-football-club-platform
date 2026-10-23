import { ArrowRight, Save, Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { createUserAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import { SettingsNavTabs } from "@/components/settings/settings-nav-tabs";

export default async function NewUserPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("users.manage", locale);
  const t = await getTranslations("users");
  const tCommon = await getTranslations("common");

  const roles = await db.role.findMany({ where: { key: { not: "staff_profile" } }, orderBy: { name: "asc" } });

  async function action(formData: FormData) {
    "use server";
    const { id } = await createUserAction(formData);
    redirect(`/${locale}/dashboard/users/${id}`);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <SettingsNavTabs locale={locale} />
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-club-primary/25 bg-club-primary/10 text-club-primary">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("addUser")}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {locale === "ar" ? "أنشئ حسابًا وحدد صلاحيات الوصول المناسبة" : "Créez un compte et définissez son rôle d’accès."}
          </p>
        </div>
      </div>
      <form action={action} encType="multipart/form-data" className="overflow-visible rounded-2xl border border-border bg-card shadow-xs">
        <div className="grid grid-cols-1 gap-x-5 gap-y-6 p-4 sm:grid-cols-2 sm:p-6">
          <div className="sm:col-span-2">
            <FileUploadDropzone
              name="photo"
              label={locale === "ar" ? "الصورة الشخصية (اختياري)" : "Photo de profil (facultative)"}
              accept="image/png,image/jpeg,image/webp,image/avif"
              hint={locale === "ar" ? "PNG أو JPG أو WebP — حتى 5 ميغابايت" : "PNG, JPG ou WebP — 5 Mo maximum"}
              theme="primary"
              imageOnly
            />
          </div>
          <label className="flex min-w-0 flex-col gap-2.5 text-xs leading-5 font-semibold text-foreground">
            <span>{locale === "ar" ? "اسم الحساب" : "Nom du compte"}</span>
            <input name="name" autoComplete="name" required className="min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20" />
          </label>
          <label className="flex min-w-0 flex-col gap-2.5 text-xs leading-5 font-semibold text-foreground">
            <span>{t("fields.email")}</span>
            <input name="email" type="email" dir="ltr" autoComplete="email" required className="min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-start text-sm font-normal outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20" />
          </label>
          <label className="flex min-w-0 flex-col gap-2.5 text-xs leading-5 font-semibold text-foreground">
            <span>{locale === "ar" ? "رقم الرخصة الإدارية (اختياري)" : "N° de licence administrative (facultatif)"}</span>
            <input name="licenseNumber" maxLength={80} className="min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20" />
          </label>
          <label className="flex min-w-0 flex-col gap-2.5 text-xs leading-5 font-semibold text-foreground">
            <span>{locale === "ar" ? "الرتبة أو الصفة في الرخصة (اختياري)" : "Fonction sur la licence (facultatif)"}</span>
            <input name="licenseRole" maxLength={120} placeholder={locale === "ar" ? "مثال: مدرب مساعد — أكابر" : "Ex. : Entraîneur adjoint — Seniors"} className="min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20" />
          </label>
          <label className="flex min-w-0 flex-col gap-2.5 text-xs leading-5 font-semibold text-foreground">
            <span>{locale === "ar" ? "اللقب (يظهر أولًا على البطاقة)" : "Nom de famille (affiché en premier)"}</span>
            <input name="lastName" autoComplete="family-name" maxLength={100} className="min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20" />
          </label>
          <label className="flex min-w-0 flex-col gap-2.5 text-xs leading-5 font-semibold text-foreground">
            <span>{locale === "ar" ? "الاسم و اللقب" : "Prénom"}</span>
            <input name="firstName" autoComplete="given-name" maxLength={100} className="min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20" />
          </label>
          <label className="flex min-w-0 flex-col gap-2.5 text-xs leading-5 font-semibold text-foreground">
            <span>{locale === "ar" ? "تاريخ الميلاد" : "Date de naissance"}</span>
            <input name="dateOfBirth" type="date" lang={locale === "ar" ? "ar-DZ" : "fr-DZ"} dir="ltr" max={new Date().toISOString().slice(0, 10)} className="min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal outline-none transition-colors focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20" />
          </label>
          <div className="flex min-w-0 flex-col gap-2.5 text-xs leading-5 font-semibold text-foreground">
            <span>{locale === "ar" ? "زمرة الدم" : "Groupe sanguin"}</span>
            <FormSelect name="bloodGroup" locale={locale} ariaLabel={locale === "ar" ? "زمرة الدم" : "Groupe sanguin"} options={[{ value: "A+", label: "A+" }, { value: "A-", label: "A−" }, { value: "B+", label: "B+" }, { value: "B-", label: "B−" }, { value: "AB+", label: "AB+" }, { value: "AB-", label: "AB−" }, { value: "O+", label: "O+" }, { value: "O-", label: "O−" }]} placeholder={locale === "ar" ? "اختر زمرة الدم" : "Choisir le groupe"} />
          </div>
          <label className="flex min-w-0 flex-col gap-2.5 text-xs leading-5 font-semibold text-foreground">
            <span>{t("fields.password")}</span>
            <input name="password" type="password" dir="ltr" autoComplete="new-password" minLength={8} maxLength={72} required className="min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-start text-sm font-normal outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20" />
            <span className="mt-0.5 block text-[11px] leading-5 font-normal text-muted-foreground">
              {locale === "ar" ? "8 أحرف على الأقل" : "8 caractères minimum"}
            </span>
          </label>
          <div className="flex min-w-0 flex-col gap-2.5 text-xs leading-5 font-semibold text-foreground">
            <span className="block">{locale === "ar" ? "صلاحية حساب المنصة" : "Autorisation du compte"}</span>
            <FormSelect
              name="roleId"
              required
              locale={locale}
              ariaLabel={locale === "ar" ? "صلاحية حساب المنصة" : "Autorisation du compte"}
              defaultValue={roles[0]?.id ?? ""}
              options={roles.map((role) => ({ value: role.id, label: role.name }))}
              placeholder={locale === "ar" ? "اختر الصلاحية" : "Sélectionner l’autorisation"}
            />
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Link href={`/${locale}/dashboard/users`} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            {tCommon("cancel")}
          </Link>
          <Button type="submit" className="gap-2 rounded-lg">
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{tCommon("save")}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
