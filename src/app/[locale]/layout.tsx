import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, directionForLocale, type AppLocale } from "@/i18n/routing";
import { Toaster } from "sonner";
import "@/app/globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as AppLocale)) notFound();

  const messages = await getMessages();
  const dir = directionForLocale(locale);

  return (
    // THIS is the actual RTL <-> LTR switch (spec section 4): the `dir`
    // attribute cascades to every descendant, and every component in this
    // project uses Tailwind's logical-property utilities (ms-/me-/ps-/pe-/
    // text-start/text-end) rather than left/right, so the SAME component
    // tree renders correctly mirrored for Arabic without any per-component
    // RTL branching logic.
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var c = (document.cookie.match(/(^|; )theme=([^;]+)/) || [])[2];
                var t = c || localStorage.getItem('theme');
                var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (t === 'dark' || ((t === 'system' || !t) && d)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch(e) {}
            })()`
          }}
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster position={dir === "rtl" ? "top-left" : "top-right"} richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
