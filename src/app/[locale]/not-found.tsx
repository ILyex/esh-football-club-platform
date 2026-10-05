import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md space-y-4 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-club-primary/10 text-club-primary font-mono text-2xl font-bold">
          404
        </div>
        <h1 className="text-xl font-bold">الصفحة غير موجودة / Page non trouvée</h1>
        <p className="text-sm text-muted-foreground">
          المسار المطلوب غير موجود أو تم نقله.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-club-primary px-4 py-2 text-sm font-bold text-white hover:bg-club-primary/90 transition-colors shadow-xs"
          >
            الرئيسية / Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
