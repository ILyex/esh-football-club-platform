import { hasArabicScript } from "@/lib/public/locale-text";

type ClubNameVariants = { ar: string; fr: string };

const ARABIC_NAME_KEYS = /^(?:nomar|namear|libellear|denominationar|nomclubar|surnomar|ar|arabic|arabicname)$/iu;
const FRENCH_NAME_KEYS = /^(?:nomfr|namefr|libellefr|denominationfr|nomclubfr|surnomfr|nomfrancais|namefrench|fr|french|frenchname|nomlatin|nom|name|libelle|label|denomination|nomclub|surnom)$/iu;
const GENERIC_NAME_KEYS = /^(?:nom|name|libelle|label|denomination|nomclub|surnom)$/iu;

/** Read club names from the different flat and nested club shapes returned by FAF EMS. */
export function extractFafClubNameVariants(club: unknown): ClubNameVariants {
  const names: ClubNameVariants = { ar: "", fr: "" };
  const visited = new Set<object>();

  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 4 || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (typeof item === "string" && item.trim()) {
        if (!names.ar && ARABIC_NAME_KEYS.test(key) && hasArabicScript(item)) names.ar = item.trim();
        if (!names.fr && FRENCH_NAME_KEYS.test(key) && (!GENERIC_NAME_KEYS.test(key) || depth <= 1) && !hasArabicScript(item)) names.fr = item.trim();
      } else {
        visit(item, depth + 1);
      }
    }
  };

  visit(club, 0);
  return names;
}
