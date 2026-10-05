import { defineRouting } from "next-intl/routing";

// Adding a language later = add its code here + a messages/<code>.json file.
// `localePrefix: "always"` keeps URLs unambiguous (/ar/..., /fr/...), which
// also makes per-language SEO (hreflang, sitemaps) straightforward — see
// spec section 56.
export const routing = defineRouting({
  locales: ["ar", "fr"],
  defaultLocale: "ar", // overridden at runtime by ClubSettings.defaultLocale if you wire that up
  localePrefix: "always"
});

export type AppLocale = (typeof routing.locales)[number];

// Single source of truth for direction — everything else (root layout,
// Tailwind logical utilities) derives from this.
export function directionForLocale(locale: string): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
