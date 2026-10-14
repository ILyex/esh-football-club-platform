import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, directionForLocale, type AppLocale } from "@/i18n/routing";
import { PlatformToaster } from "@/components/shared/platform-toaster";
import "@/app/globals.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const name = locale === "ar"
    ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم"
    : "Association Sportive Espoir Sidi Hosni de Football";

  return {
    title: name,
    icons: {
      icon: [
        { url: "/branding/esh-logo-32.png", sizes: "32x32", type: "image/png" },
        { url: "/branding/esh-logo-128.png", sizes: "128x128", type: "image/png" },
        { url: "/branding/esh-logo.ico", type: "image/x-icon" }
      ],
      shortcut: "/branding/esh-logo.ico",
      apple: "/branding/esh-logo-128.png"
    }
  };
}

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
                var dark = t === 'dark' || ((t === 'system' || !t) && d);
                if (dark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
                document.documentElement.style.backgroundColor = dark ? '#0c0d0e' : '#f8f9fa';
                document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
              } catch(e) {}
            })()`
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              function isImageTarget(target){ return target instanceof HTMLImageElement || (target && target.closest && target.closest('img')); }
              document.addEventListener('dragstart', function(e){ if (isImageTarget(e.target)) e.preventDefault(); }, true);
              document.addEventListener('contextmenu', function(e){ if (isImageTarget(e.target)) e.preventDefault(); }, true);
            })()`
          }}
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
          <PlatformToaster position={dir === "rtl" ? "top-left" : "top-right"} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
