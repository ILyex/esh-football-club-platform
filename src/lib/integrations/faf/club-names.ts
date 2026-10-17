import { hasArabicScript } from "@/lib/public/locale-text";

type ClubNameVariants = { ar: string; fr: string };

const ARABIC_NAME_KEYS = /^(?:nomar|namear|libellear|denominationar|nomclubar|surnomar|clubnamear|teamnamear|nomcompletar|ar|arabic|arabicname)$/iu;
const FRENCH_NAME_KEYS = /^(?:nomfr|namefr|libellefr|denominationfr|nomclubfr|surnomfr|clubnamefr|teamnamefr|nomcompletfr|nomfrancais|namefrench|fr|french|frenchname|nomlatin|nom|name|libelle|label|denomination|nomclub|clubname|teamname|surnom)$/iu;
const GENERIC_NAME_KEYS = /^(?:nom|name|libelle|label|denomination|nomclub|clubname|teamname|surnom)$/iu;
const CLUB_NAME_FIELD = /(?:nom|name|libelle|label|denomination|surnom)/u;

function normalizeFieldKey(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("fr");
}

export function isFafClubNamePlaceholder(value: string): boolean {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("fr").replace(/[^\p{L}\p{N}]/gu, "");
  return /^(?:nomduclubadverse|nomdelequipeadverse|clubadverse|equipeadverse|opponent|opponentclub|opponentteam|opponentname|adversary|unknown|inconnu|inconnue|nondisponible|الفريقالمنافس|الفريقالخصم|اسمالفريقالمنافس)$/u.test(normalized);
}

type NameCandidate = { value: string; score: number };

/** Read club names from the different flat and nested club shapes returned by FAF EMS. */
export function extractFafClubNameVariants(club: unknown): ClubNameVariants {
  const candidates: { ar: NameCandidate[]; fr: NameCandidate[] } = { ar: [], fr: [] };
  const visited = new Set<object>();

  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 6 || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (typeof item === "string" && item.trim()) {
        const normalizedKey = normalizeFieldKey(key);
        const isGenericName = GENERIC_NAME_KEYS.test(normalizedKey);
        const isArabicNameField = ARABIC_NAME_KEYS.test(normalizedKey) || (CLUB_NAME_FIELD.test(normalizedKey) && /(?:ar|arabe|arabic)$/u.test(normalizedKey));
        const isFrenchNameField = FRENCH_NAME_KEYS.test(normalizedKey) || (CLUB_NAME_FIELD.test(normalizedKey) && /(?:fr|francais|french|latin)$/u.test(normalizedKey));
        const nameValue = item.trim();
        if (isFafClubNamePlaceholder(nameValue)) continue;

        // EMS uses several JSON shapes. Prefer explicit language fields, then
        // accept a generic club-name field nested up to two levels deep.
        // Ranking avoids accidentally taking an unrelated nested label first.
        if (hasArabicScript(nameValue) && (isArabicNameField || (isGenericName && depth <= 2))) {
          candidates.ar.push({ value: nameValue, score: (isArabicNameField ? 100 : 60) - depth });
        }
        if (!hasArabicScript(nameValue) && isFrenchNameField && (!isGenericName || depth <= 2)) {
          candidates.fr.push({ value: nameValue, score: (isGenericName && !/(?:fr|francais|french|latin)$/u.test(normalizedKey) ? 60 : 100) - depth });
        }
      } else {
        visit(item, depth + 1);
      }
    }
  };

  visit(club, 0);
  const best = (items: NameCandidate[]) => items.sort((left, right) => right.score - left.score)[0]?.value ?? "";
  return { ar: best(candidates.ar), fr: best(candidates.fr) };
}
