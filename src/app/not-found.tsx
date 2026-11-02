import Link from "next/link";

/**
 * Root 404 for URLs that never matched a locale segment (for example /xyz).
 * It is deliberately bilingual: the visitor's language is unknown at this
 * point, so the page shows Arabic and French with correct direction for each
 * (the French block was previously rendered inside an RTL document, which
 * reversed its punctuation and alignment).
 */
export default function RootNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=(document.cookie.match(/(^|; )theme=([^;]+)/)||[])[2];var t=c||localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||((t==='system'||!t)&&d))document.documentElement.classList.add('dark');}catch(e){}})()`
          }}
        />
      </head>
      <body suppressHydrationWarning className="flex min-h-screen flex-col items-center justify-center p-4 text-center font-sans bg-background text-foreground">
        <div className="w-full max-w-md space-y-5 rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-club-primary/10 font-mono text-2xl font-bold text-club-primary">
            404
          </div>

          <div className="space-y-2">
            <h1 lang="ar" className="text-lg font-bold">الصفحة غير موجودة</h1>
            <p lang="ar" className="text-sm text-muted-foreground">
              المسار المطلوب غير موجود أو تم نقله.
            </p>
          </div>

          <div lang="fr" dir="ltr" className="space-y-2 border-t border-border pt-4">
            <h2 className="text-sm font-bold">Page introuvable</h2>
            <p className="text-sm text-muted-foreground">
              L’adresse demandée n’existe pas ou a été déplacée.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
            <Link
              href="/ar"
              className="inline-flex items-center justify-center rounded-lg bg-club-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-club-primary/90"
            >
              الصفحة الرئيسية
            </Link>
            <Link
              href="/fr"
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-bold transition-colors hover:bg-muted"
            >
              Accueil
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
