import { getTranslations } from "next-intl/server";
import arMessages from "@/i18n/messages/ar.json";
import frMessages from "@/i18n/messages/fr.json";

const STATIC_CATALOGS: Record<string, any> = {
  ar: arMessages,
  fr: frMessages
};

/**
 * Returns a localized label for a document type (TemplateType enum).
 * Falls back to the raw enum value if a translation is missing.
 */
export async function getDocumentTypeLabel(type: string, locale?: string): Promise<string> {
  const loc = locale === "fr" ? "fr" : "ar";
  try {
    const t = locale
      ? await getTranslations({ locale: loc, namespace: "documents" })
      : await getTranslations("documents");
    const key = `types.${type}` as const;
    const translated = t(key as any) as unknown as string;
    if (!translated || translated === key) {
      return (t("types.UNKNOWN" as any) as unknown as string) || "Unknown";
    }
    return translated;
  } catch {
    // Direct static fallback for test runners or offline renderers
    const cat = STATIC_CATALOGS[loc] || STATIC_CATALOGS.ar;
    const val = cat?.documents?.types?.[type];
    if (val) return val;
    return cat?.documents?.types?.UNKNOWN || "Unknown";
  }
}
