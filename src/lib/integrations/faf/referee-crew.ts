type RefereeNames = { ar: string; fr: string };
export type FafRefereeCrew = { ar: string[]; fr: string[] };

const hasArabic = (value: string) => /[\u0600-\u06FF]/u.test(value);

export function isArabicRefereeName(value: string | null | undefined): boolean {
  return Boolean(value && hasArabic(value));
}

function firstText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function namesFrom(value: unknown): RefereeNames {
  if (typeof value === "string") {
    const name = value.trim();
    return hasArabic(name) ? { ar: name, fr: "" } : { ar: "", fr: name };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ar: "", fr: "" };
  const record = value as Record<string, unknown>;
  const arFull = firstText(record, ["fullNameAr", "nameAr", "nomCompletAr", "nomCompletArabic", "arabicName", "nameArabic", "nomArabe"]);
  const frFull = firstText(record, ["fullNameFr", "nameFr", "nomCompletFr", "fullName", "displayName", "nomComplet", "name", "nom"]);
  const arFirst = firstText(record, ["firstNameAr", "firstNameArabic", "givenNameAr", "prenomArbitreAr", "prenomAr", "prenomArabe"]);
  const arLast = firstText(record, ["lastNameAr", "lastNameArabic", "familyNameAr", "nomArbitreAr", "nomAr", "nomArabe"]);
  const frFirst = firstText(record, ["firstNameFr", "firstName", "givenName", "prenomArbitre", "prenom", "first_name"]);
  const frLast = firstText(record, ["lastNameFr", "lastName", "familyName", "nomArbitre", "nom", "last_name"]);
  const generic = firstText(record, ["prenom", "nom", "firstName", "lastName", "name", "fullName", "prenomArbitre", "nomArbitre"]);
  const detected = [arFull, frFull, arFirst, arLast, frFirst, frLast, generic, record.prenomArbitre, record.nomArbitre]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()));
  return {
    ar: arFull || [arFirst, arLast].filter(Boolean).join(" ") || detected.find(hasArabic) || "",
    fr: frFull && !hasArabic(frFull) ? frFull : [frFirst, frLast].filter((part) => part && !hasArabic(part)).join(" ") || detected.find((part) => !hasArabic(part)) || ""
  };
}

function roleIndex(label: string): number | null {
  const key = label.normalize("NFKD").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (/remplac|reserve|substitut|quatri|fourth|احتياط|بديل/.test(key) || /(?:arbitre|referee)(?:4|04)$/.test(key)) return 3;
  if (/deuxieme|second|2e|assistant2|arbitre2|referee2|الثاني|ثاني/.test(key) || /(?:arbitre|referee)(?:assistant)?0?2$/.test(key)) return 2;
  if (/premier|first|1er|assistant1|arbitre1|referee1|الأول|اول|أول/.test(key) || /(?:arbitre|referee)(?:assistant)?0?1$/.test(key)) return 1;
  if (/assistant|adjoint/.test(key)) return 1;
  if (/principal|central|main|رئيس/.test(key) || /^(?:arbitre|referee|الحكم)$/.test(key)) return 0;
  return null;
}

const ARRAY_KEYS = ["arbitres", "referees", "refereeTeam", "equipeArbitrale", "equipeArbitrage", "officielsArbitrage"];
const ROLE_LABEL_KEYS = ["role", "fonction", "libelle", "label", "type", "poste"];

/** Reads the complete officiating crew, preserving role order and both EMS name variants. */
export function extractFafRefereeCrew(...records: unknown[]): FafRefereeCrew {
  const slots: RefereeNames[] = Array.from({ length: 4 }, () => ({ ar: "", fr: "" }));
  const fill = (index: number, person: unknown) => {
    if (index < 0 || index >= slots.length) return;
    const names = namesFrom(person);
    if (!slots[index]!.ar && names.ar) slots[index]!.ar = names.ar;
    if (!slots[index]!.fr && names.fr) slots[index]!.fr = names.fr;
  };

  for (const value of records) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    for (const [key, person] of Object.entries(record)) {
      if (!/(arbit|referee)/iu.test(key) || ARRAY_KEYS.includes(key)) continue;
      const index = roleIndex(key.replace(/(?:ar|fr|arabic|french)$/iu, ""));
      if (index !== null) fill(index, person);
    }
    for (const key of ARRAY_KEYS) {
      const crew = record[key];
      if (!Array.isArray(crew)) continue;
      crew.forEach((person, order) => {
        const personRecord = person && typeof person === "object" ? person as Record<string, unknown> : null;
        const label = personRecord ? firstText(personRecord, ROLE_LABEL_KEYS) : "";
        const index = roleIndex(label) ?? order;
        fill(index, person);
      });
    }
  }

  const unique = (language: "ar" | "fr") => {
    const seen = new Set<string>();
    return slots.map((slot) => slot[language]).filter((name) => {
      const key = name.normalize("NFKD").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  return { ar: unique("ar"), fr: unique("fr") };
}
