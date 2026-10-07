import Link from "next/link";
import { ShieldX } from "lucide-react";

export default async function AccessDeniedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isArabic = locale !== "fr";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldX aria-hidden="true" size={28} />
        </div>
        <p className="mb-2 font-mono text-sm font-semibold tracking-widest text-destructive">403</p>
        <h1 className="text-xl font-bold">
          {isArabic ? "لا تملك صلاحية الوصول إلى هذه الصفحة" : "Vous n’avez pas accès à cette page"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {isArabic
            ? "حسابك لا يملك الإذن المطلوب. إذا كنت تحتاج هذه الصفحة، تواصل مع مدير المنصة لمنحك الصلاحية المناسبة."
            : "Votre compte ne dispose pas de l’autorisation requise. Contactez l’administrateur de la plateforme si cet accès est nécessaire."}
        </p>
        <Link
          href={`/${isArabic ? "ar" : "fr"}/dashboard`}
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {isArabic ? "العودة إلى الرئيسية" : "Retour à l’accueil"}
        </Link>
      </section>
    </main>
  );
}
