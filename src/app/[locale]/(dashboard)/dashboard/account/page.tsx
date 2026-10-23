import { Camera, KeyRound, ShieldCheck } from "lucide-react";
import { getSessionOrThrow } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { AvatarUploadField } from "@/components/users/avatar-upload-field";
import { SafeImage } from "@/components/shared/safe-image";
import { changeOwnPasswordAction, changeOwnPhotoAction } from "./actions";
import { PasswordVisibilityInput } from "./password-visibility-input";

const errorText = (locale: string, error?: string) => {
  if (!error) return null;
  const ar = locale === "ar";
  const messages: Record<string, [string, string]> = {
    current_password_invalid: ["كلمة المرور الحالية غير صحيحة.", "Le mot de passe actuel est incorrect."],
    password_mismatch: ["تأكيد كلمة المرور الجديدة غير متطابق.", "La confirmation du nouveau mot de passe ne correspond pas."],
    password_invalid: ["كلمة المرور يجب أن تكون 8 أحرف على الأقل ولا تتجاوز 72 بايتًا.", "Le mot de passe doit contenir au moins 8 caractères et ne pas dépasser 72 octets."],
    too_many_attempts: ["تجاوزت عدد المحاولات. حاول بعد 15 دقيقة.", "Trop de tentatives. Réessayez dans 15 minutes."]
  };
  return messages[error]?.[ar ? 0 : 1] ?? null;
};

export default async function AccountSecurityPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; photo?: string; photoError?: string }>;
}) {
  const [{ locale }, { error, photo, photoError }, user] = await Promise.all([
    params,
    searchParams,
    getSessionOrThrow()
  ]);
  const accountPhoto = await db.user.findUnique({
    where: { id: user.id },
    select: { image: true, staff: { select: { photoUrl: true } } }
  });
  const isAr = locale === "ar";
  const currentPhoto = accountPhoto?.image || accountPhoto?.staff?.photoUrl;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <header className="space-y-1 border-b border-border/70 pb-4">
        <h1 className="text-2xl font-black tracking-tight">{isAr ? "حسابي وأمان الحساب" : "Mon compte et sa sécurité"}</h1>
        <p className="text-sm text-muted-foreground">{isAr ? "غيّر كلمة مرور حسابك بعد التحقق من كلمة المرور الحالية." : "Modifiez le mot de passe après vérification de votre mot de passe actuel."}</p>
      </header>

      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary"><Camera className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="text-base font-bold">{isAr ? "الصورة الشخصية" : "Photo de profil"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{isAr ? "غيّر الصورة التي تظهر بجانب اسمك في المنصة." : "Modifiez la photo affichée à côté de votre nom sur la plateforme."}</p>
          </div>
        </div>

        {photo === "saved" && <p role="status" className="rounded-xl border border-emerald-600/25 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{isAr ? "تم تحديث صورتك الشخصية." : "Votre photo de profil a été mise à jour."}</p>}
        {photoError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{photoError === "too_large" ? (isAr ? "حجم الصورة كبير. اختر صورة أصغر." : "La photo est trop volumineuse. Choisissez une image plus petite.") : photoError === "required" ? (isAr ? "اختر صورة أولًا." : "Choisissez d’abord une photo.") : (isAr ? "تعذر تحديث الصورة. تحقق من نوع الملف وحاول مجددًا." : "Impossible de mettre à jour la photo. Vérifiez le fichier et réessayez.")}</p>}

        <form action={changeOwnPhotoAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
              {currentPhoto ? <SafeImage src={currentPhoto} fallbackSrc="/branding/esh-logo-64.png" alt={user.name} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xl font-black text-muted-foreground">{user.name.slice(0, 1).toUpperCase()}</span>}
            </div>
            <div className="min-w-0 flex-1"><AvatarUploadField locale={locale} /></div>
          </div>
          <div className="flex justify-end border-t border-border pt-4">
            <Button type="submit" className="shrink-0">{isAr ? "حفظ الصورة" : "Enregistrer la photo"}</Button>
          </div>
        </form>
      </section>

      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary"><KeyRound className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="text-base font-bold">{isAr ? "تغيير كلمة المرور" : "Changer le mot de passe"}</h2>
            <p className="mt-1 break-all text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {errorText(locale, error) && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorText(locale, error)}</p>}

        <form action={changeOwnPasswordAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium sm:col-span-2">
              <span>{isAr ? "كلمة المرور الحالية" : "Mot de passe actuel"}</span>
              <PasswordVisibilityInput name="currentPassword" autoComplete="current-password" locale={locale} showLabel={isAr ? "إظهار كلمة المرور الحالية" : "Afficher le mot de passe actuel"} hideLabel={isAr ? "إخفاء كلمة المرور الحالية" : "Masquer le mot de passe actuel"} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>{isAr ? "كلمة المرور الجديدة" : "Nouveau mot de passe"}</span>
              <PasswordVisibilityInput name="newPassword" autoComplete="new-password" locale={locale} showLabel={isAr ? "إظهار كلمة المرور الجديدة" : "Afficher le nouveau mot de passe"} hideLabel={isAr ? "إخفاء كلمة المرور الجديدة" : "Masquer le nouveau mot de passe"} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>{isAr ? "تأكيد كلمة المرور الجديدة" : "Confirmer le nouveau mot de passe"}</span>
              <PasswordVisibilityInput name="confirmPassword" autoComplete="new-password" locale={locale} showLabel={isAr ? "إظهار تأكيد كلمة المرور" : "Afficher la confirmation du mot de passe"} hideLabel={isAr ? "إخفاء تأكيد كلمة المرور" : "Masquer la confirmation du mot de passe"} />
            </label>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
            <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{isAr ? "بعد الحفظ ستُنهى الجلسات على أجهزتك، وسجّل الدخول مجددًا بكلمة المرور الجديدة." : "Après l’enregistrement, vos sessions seront fermées sur vos appareils. Reconnectez-vous avec le nouveau mot de passe."}</p>
            <Button type="submit" className="shrink-0">{isAr ? "حفظ كلمة المرور" : "Enregistrer le mot de passe"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
