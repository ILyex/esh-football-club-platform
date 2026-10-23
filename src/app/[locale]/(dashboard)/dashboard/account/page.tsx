import { KeyRound, ShieldCheck } from "lucide-react";
import { getSessionOrThrow } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { changeOwnPasswordAction } from "./actions";

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
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ locale }, { error }, user] = await Promise.all([params, searchParams, getSessionOrThrow()]);
  const isAr = locale === "ar";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <header className="space-y-1 border-b border-border/70 pb-4">
        <h1 className="text-2xl font-black tracking-tight">{isAr ? "حسابي وأمان الحساب" : "Mon compte et sa sécurité"}</h1>
        <p className="text-sm text-muted-foreground">{isAr ? "غيّر كلمة مرور حسابك بعد التحقق من كلمة المرور الحالية." : "Modifiez le mot de passe après vérification de votre mot de passe actuel."}</p>
      </header>

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
              <input name="currentPassword" type="password" autoComplete="current-password" minLength={8} maxLength={72} required className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>{isAr ? "كلمة المرور الجديدة" : "Nouveau mot de passe"}</span>
              <input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>{isAr ? "تأكيد كلمة المرور الجديدة" : "Confirmer le nouveau mot de passe"}</span>
              <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
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
