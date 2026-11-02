import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Cairo, IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import { routing, directionForLocale, type AppLocale } from "@/i18n/routing";
import { PlatformToaster } from "@/components/shared/platform-toaster";
import "@/app/globals.css";

// Download fonts at build time and serve them from this deployment. The Arabic
// dashboard must not wait on a third-party font stylesheet for every session.
const cairo = Cairo({
  // Include Latin glyphs too so bilingual controls never fall back to a
  // platform font when the active locale is Arabic.
  subsets: ["arabic", "latin"],
  weight: "variable",
  variable: "--font-cairo",
  display: "swap",
  preload: true
});
const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-ibm-plex-arabic",
  display: "swap",
  preload: true
});
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-plus-jakarta",
  display: "swap"
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const name = locale === "ar"
    ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم"
    : "Association Sportive Espoir Sidi Hosni de Football";

  return {
    metadataBase: new URL((process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")),
    title: {
      default: name,
      template: `%s | ${locale === "ar" ? "أمل سيدي حسني" : "ESH"}`
    },
    description: locale === "ar"
      ? "الموقع الرسمي للجمعية الرياضية أمل سيدي حسني: الأخبار، المباريات، الترتيب، الفرق، والمعرض."
      : "Site officiel de l'Association Sportive Espoir Sidi Hosni : actualités, matchs, classement, équipes et galerie.",
    alternates: {
      canonical: `/${locale === "ar" ? "ar" : "fr"}`,
      languages: { ar: "/ar", fr: "/fr", "x-default": "/ar" }
    },
    openGraph: {
      type: "website",
      siteName: name,
      locale: locale === "ar" ? "ar_DZ" : "fr_DZ",
      alternateLocale: locale === "ar" ? "fr_DZ" : "ar_DZ",
      title: name,
      description: locale === "ar"
        ? "الموقع الرسمي للجمعية الرياضية أمل سيدي حسني."
        : "Site officiel de l'Association Sportive Espoir Sidi Hosni.",
      url: `/${locale === "ar" ? "ar" : "fr"}`,
      images: [{ url: "/branding/esh-header-crest.png", width: 1200, height: 630, alt: name }]
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      images: ["/branding/esh-header-crest.png"]
    },
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
    <html
      lang={locale}
      dir={dir}
      className={`${plusJakarta.variable} ${cairo.variable} ${ibmPlexArabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              var key='esh:client-recovery';
              function isAssetLoadError(text){
                return /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i.test(text)||text.indexOf('_next/static/chunks/')!==-1||text.indexOf('_next/static/css/')!==-1;
              }
              function maybeRecover(event){
                var target=event&&event.target;
                var url=target instanceof HTMLScriptElement?target.src:target instanceof HTMLLinkElement?target.href:'';
                var error=event&&event.error;
                var text=[error&&error.name,error&&error.message,event&&event.message,url].filter(Boolean).join(' ');
                if(!(isAssetLoadError(text)||/Minified React error #(?:418|423|425)\b/.test(text)))return;
                try{
                  var now=Date.now();
                  var saved=JSON.parse(sessionStorage.getItem(key)||'null');
                  var recent=saved&&typeof saved.startedAt==='number'&&now-saved.startedAt<60000;
                  var count=recent?Number(saved.count||0):0;
                  if(count>=3)return;
                  sessionStorage.setItem(key,JSON.stringify({count:count+1,startedAt:recent?saved.startedAt:now}));
                  window.location.reload();
                }catch(e){}
              }
              window.addEventListener('error',maybeRecover,true);
              window.addEventListener('unhandledrejection',function(event){
                var reason=event&&event.reason;
                var text=reason&&reason.message?reason.name+' '+reason.message:String(reason||'');
                if(isAssetLoadError(text)||/Minified React error #(?:418|423|425)\b/.test(text))maybeRecover({message:text,error:reason});
              });
              window.addEventListener('load',function(){window.setTimeout(function(){try{sessionStorage.removeItem(key)}catch(e){}},20000)},{once:true});
            })()`
          }}
        />
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
        {/* The old inline script blocked right-click and drag-start on every
            image. It never protected anything (the files are public URLs) and
            it broke "open image in new tab", copy and drag-into-upload — so it
            is gone. */}
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
