"use client";

import { useActionState, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { loginAction } from "./actions";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ClubLogo } from "@/components/shared/club-logo";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { CapLoginWidget } from "@/components/auth/cap-login-widget";

export default function LoginPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const routeParams = useParams();
  const locale = (routeParams?.locale as string) || "ar";
  const callbackUrl = searchParams.get("callbackUrl") ?? "";
  const passwordChanged = searchParams.get("passwordChanged") === "1";
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaWidgetVersion, setCaptchaWidgetVersion] = useState(0);
  const captchaEnabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_CAPTCHA_ENABLED === "true" || process.env.NEXT_PUBLIC_CAPTCHA_ENABLED === "1";
  const captchaEndpoint = "/api/captcha/";

  useEffect(() => {
    if (state?.error) {
      setCaptchaToken("");
      setCaptchaWidgetVersion((version) => version + 1);
    }
  }, [state]);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("esh_remembered_email");
      if (savedEmail) {
        setEmail(savedEmail.trim());
      }
    } catch {
      // Ignore localStorage unavailable
    }
  }, []);

  const isRtl = locale === "ar";
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const publicSiteUrl = getPublicSiteUrl(locale);

  // On phones, a login page may have been opened from a protected route.
  // Give the browser back button a local history entry so it can return to
  // the public site instead of bouncing through the protected route/login.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;

    window.history.pushState({ ...window.history.state, loginBackGuard: true }, "", window.location.href);
    const handlePopState = () => window.location.replace(publicSiteUrl);
    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [publicSiteUrl]);

  return (
    <div className="relative isolate flex min-h-[100svh] w-full flex-col justify-between overflow-hidden bg-background text-foreground selection:bg-club-primary selection:text-white">

      {/* Subtle club-colored atmosphere behind the login surfaces. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full login-glow-red" />
        <div className="absolute -bottom-64 -left-48 h-[36rem] w-[36rem] rounded-full login-glow-green" />
        <div className="absolute inset-0 login-diagonal-glow" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 w-full border-b border-border/70 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Link back to public site */}
          <Link
            href={publicSiteUrl}
            aria-label={isRtl ? "العودة للموقع الرسمي" : "Retour au site officiel"}
            title={isRtl ? "العودة للموقع الرسمي" : "Retour au site officiel"}
            className="group inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card/70 px-0 py-0 text-xs font-semibold text-muted-foreground shadow-2xs transition-[color,border-color,background-color] duration-150 motion-reduce:transition-none hover:border-club-primary/40 hover:bg-card hover:text-foreground sm:h-auto sm:w-auto sm:justify-start sm:gap-2 sm:px-3.5 sm:py-1.5"
          >
            <ArrowIcon className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
            <span className="hidden sm:inline">{isRtl ? "العودة للموقع الرسمي" : "Retour au site officiel"}</span>
          </Link>

          {/* Controls: Theme Toggle & Language Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle locale={locale} />

            <div className="flex items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs font-medium">
              <Link
                href="/ar/login"
                className={`rounded-md px-2.5 py-1 transition-[color,background-color] duration-150 motion-reduce:transition-none ${
                  locale === "ar"
                    ? "bg-club-primary text-white font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span lang="ar" dir="rtl" className="language-label-arabic">عربي</span>
              </Link>
              <Link
                href="/fr/login"
                className={`rounded-md px-2.5 py-1 transition-[color,background-color] duration-150 motion-reduce:transition-none ${
                  locale === "fr"
                    ? "bg-club-primary text-white font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span lang="fr" dir="ltr" className="language-label-latin">FR</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Center Section: Institutional Login Presentation */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:px-6">
        <div className="grid w-full max-w-5xl grid-cols-1 items-stretch gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(26rem,1.1fr)] md:gap-6">
          {/* Club identity panel: keeps the football visual distinct from the credential form. */}
          <aside className="relative order-1 hidden min-h-[34rem] overflow-hidden rounded-3xl border border-border/80 bg-card/65 p-8 text-foreground shadow-lg shadow-black/[0.04] md:flex md:flex-col md:justify-between lg:p-10">
            <div className="pointer-events-none absolute inset-0 login-side-glow" aria-hidden="true" />
            <div className="absolute inset-x-0 top-0 h-1 bg-club-primary" aria-hidden="true" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-club-primary/20 bg-white p-0.5 shadow-xs">
                <ClubLogo src="/branding/esh-logo-256.png" fallbackSrc="/branding/esh-logo-256.png" alt={isRtl ? "الشعار الرسمي لنادي أمل سيدي حسني" : "Logo officiel d’Espoir Sidi Hosni"} className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">E SIDI HOSNI</p>
                <p className="mt-1 text-sm font-bold text-foreground">{isRtl ? "بوابة النادي" : "Portail du club"}</p>
              </div>
            </div>

            <div className="relative max-w-md py-10">
              <div className="mb-5 h-1 w-12 rounded-full bg-club-primary" />
              <h2 className="text-3xl font-black leading-tight tracking-tight lg:text-4xl">
                {isRtl ? "نخطط للموسم، ونصنع الفوز معًا" : "Préparons la saison et gagnons ensemble"}
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
                {isRtl
                  ? "منصة موحدة لمتابعة الفرق واللاعبين والأنشطة اليومية للنادي."
                  : "Une plateforme unifiée pour suivre les équipes, les joueurs et les activités du club."}
              </p>
            </div>

            <div className="relative border-t border-border pt-4 text-xs text-muted-foreground">
              <span className="club-name">{isRtl ? "منذ 2018 · الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Depuis 2018 · Association Sportive Espoir Sidi Hosni de Football"}</span>
            </div>
          </aside>

          <div className="relative order-2 overflow-hidden rounded-3xl border border-border/80 bg-card/80 p-6 shadow-xl shadow-black/[0.08] backdrop-blur-2xl sm:p-8 lg:p-9">
            <div className="pointer-events-none absolute inset-0 login-panel-glow" aria-hidden="true" />
            <div className="absolute inset-x-0 top-0 h-1 bg-club-primary" />

            <div className="relative mb-6 border-b border-border/70 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-club-primary/20 bg-white p-0.5 md:hidden">
                  <ClubLogo src="/branding/esh-logo-256.png" fallbackSrc="/branding/esh-logo-256.png" alt={isRtl ? "الشعار الرسمي لنادي أمل سيدي حسني" : "Logo officiel d’Espoir Sidi Hosni"} className="h-full w-full object-contain" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                    {t("login")}
                  </h1>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    {isRtl ? "أدخل بيانات حسابك للمتابعة إلى منصة النادي." : "Connectez-vous pour accéder à la plateforme du club."}
                  </p>
                </div>
              </div>
            </div>

            {passwordChanged && (
              <p role="status" className="relative mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                {isRtl
                  ? "تم تغيير كلمة المرور بنجاح. سجّل الدخول الآن باستخدام كلمة المرور الجديدة."
                  : "Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe."}
              </p>
            )}

            {/* Login Form */}
            <form
              action={formAction}
              onSubmit={() => {
                try {
                  if (rememberMe && email) {
                    localStorage.setItem("esh_remembered_email", email.trim().toLowerCase());
                  } else {
                    localStorage.removeItem("esh_remembered_email");
                  }
                } catch {
                  // ignore
                }
              }}
              className="relative space-y-4"
            >
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
              <input type="hidden" name="locale" value={locale} />

              {/* Email Address Input */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-xs font-semibold text-foreground/90">
                  {t("email")}
                </label>
                <div className="relative">
                  <div className={`pointer-events-none absolute inset-y-0 ${isRtl ? "right-0 pr-3.5" : "left-0 pl-3.5"} flex items-center text-muted-foreground`}>
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    name="email"
                    id="login-email"
                    type="email"
                    maxLength={254}
                    pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                    title={isRtl ? "أدخل بريدًا إلكترونيًا صحيحًا يحتوي على @" : "Saisissez une adresse e-mail valide contenant @"}
                    required
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@esh-club.dz"
                    className={`login-input w-full rounded-xl border border-foreground/50 bg-muted/40 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-[border-color,background-color,box-shadow] duration-150 focus:border-club-primary focus:bg-background focus:outline-hidden focus:ring-2 focus:ring-club-primary/20 motion-reduce:transition-none ${isRtl ? "pl-4 pr-10 text-right" : "pl-10 pr-4 text-left"}`}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="block text-xs font-semibold text-foreground/90">
                    {t("password")}
                  </label>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    name="password"
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    maxLength={72}
                    required
                    minLength={8}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    className="login-input w-full rounded-xl border border-foreground/50 bg-muted/40 py-2.5 ps-10 pe-12 text-sm text-foreground placeholder:text-muted-foreground/60 transition-[border-color,background-color,box-shadow] duration-150 focus:border-club-primary focus:bg-background focus:outline-hidden focus:ring-2 focus:ring-club-primary/20 motion-reduce:transition-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 end-0 flex w-12 items-center justify-center rounded-e-xl text-muted-foreground transition-colors hover:bg-club-primary/10 hover:text-club-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-club-primary cursor-pointer motion-reduce:transition-none"
                    aria-label={showPassword
                      ? (isRtl ? "إخفاء كلمة المرور" : "Masquer le mot de passe")
                      : (isRtl ? "عرض كلمة المرور" : "Afficher le mot de passe")}
                    aria-pressed={showPassword}
                    title={showPassword
                      ? (isRtl ? "إخفاء كلمة المرور" : "Masquer le mot de passe")
                      : (isRtl ? "عرض كلمة المرور" : "Afficher le mot de passe")}
                  >
                    {showPassword
                      ? <EyeOff className="h-[18px] w-[18px] transition-transform duration-200 motion-reduce:transition-none" aria-hidden="true" />
                      : <Eye className="h-[18px] w-[18px] transition-transform duration-200 motion-reduce:transition-none" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {captchaEnabled && (
                <div className="space-y-1.5" aria-label={isRtl ? "هل أنت إنسان؟" : "Êtes-vous humain ?"}>
                  <p className="text-xs font-semibold text-foreground/90">{isRtl ? "هل أنت إنسان؟" : "Êtes-vous humain ?"}</p>
                  <CapLoginWidget
                    key={captchaWidgetVersion}
                    endpoint={captchaEndpoint}
                    locale={locale}
                    onReady={setCaptchaReady}
                    onToken={setCaptchaToken}
                  />
                </div>
              )}

              {/* Remember Me Option */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setRememberMe(val);
                      if (!val) {
                        try {
                          localStorage.removeItem("esh_remembered_email");
                        } catch {}
                      }
                    }}
                    className="login-remember-checkbox"
                  />
                  <span className="font-medium">{isRtl ? "تذكّرني" : "Se souvenir de moi"}</span>
                </label>
              </div>

              {/* Error Alert Display */}
              {state?.error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive animate-in fade-in duration-200"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    {state.error === "rate_limited"
                      ? isRtl
                        ? "تم تجاوز عدد المحاولات المسموح بها. يرجى المحاولة بعد قليل."
                        : "Trop de tentatives. Veuillez patienter avant de réessayer."
                      : state.error === "invalid_email"
                        ? t("invalidEmail")
                        : state.error === "invalid_password"
                          ? t("invalidPassword")
                          : state.error === "captcha_required"
                            ? t("captchaRequired")
                            : state.error === "captcha_unavailable"
                              ? t("captchaUnavailable")
                          : state.error === "login_unavailable"
                            ? t("serviceUnavailable")
                            : t("loginError")}
                  </span>
                </div>
              )}

              {/* Submit / Login Button */}
              <button
                type="submit"
                disabled={pending || (captchaEnabled && (!captchaReady || !captchaToken))}
                className="w-full mt-2 rounded-xl bg-club-primary hover:bg-club-primary-hover py-2.5 text-sm font-bold text-white shadow-md shadow-club-primary/25 transition-[background-color,box-shadow,transform] duration-150 motion-reduce:transition-none active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
              >
                {pending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>{isRtl ? "جارٍ تسجيل الدخول..." : "Connexion en cours..."}</span>
                  </>
                ) : (
                  <>
                    <span>{t("login")}</span>
                    <ArrowIcon className="h-4 w-4 rtl:rotate-180" />
                  </>
                )}
              </button>
            </form>

          </div>
        </div>
      </main>

      {/* Footer Line */}
      <footer className="login-copyright relative z-10 w-full border-t border-border/70 bg-background/75 py-4 text-center text-xs text-muted-foreground backdrop-blur-xl">
        <p>
          {isRtl ? (
            <><span className="club-name">الجمعية الرياضية أمل سيدي حسني لكرة القدم</span>. جميع الحقوق محفوظة. <bdi dir="ltr">© {new Date().getFullYear()}</bdi></>
          ) : (
            <>© {new Date().getFullYear()} <span className="club-name">Association Sportive Espoir Sidi Hosni de Football</span>. Tous droits réservés.</>
          )}
        </p>
      </footer>
    </div>
  );
}
