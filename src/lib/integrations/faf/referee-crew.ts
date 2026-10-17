import { transliterateRefereeName } from "@/lib/matches/referees";

type RefereeNames = { ar: string; fr: string };
export type FafRefereeCrew = { ar: string[]; fr: string[] };

const hasArabic = (value: string) => /[\u0600-\u06FF]/u.test(value);
const normalizeKey = (value: string) => value.normalize("NFKD").toLocaleLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]/gu, "");

export function isArabicRefereeName(value: string | null | undefined): boolean {
  return Boolean(value && hasArabic(value));
}

function firstText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const normalized = new Map(Object.entries(record).map(([key, value]) => [normalizeKey(key), value]));
  for (const key of keys) {
    const value = normalized.get(normalizeKey(key));
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
  const localizedName = record.name && typeof record.name === "object" && !Array.isArray(record.name)
    ? record.name as Record<string, unknown>
    : {};
  const arFull = firstText(record, ["fullNameAr", "nameAr", "nomCompletAr", "nomCompletArabic", "arabicName", "nameArabic", "nomArabe", "arabic", "ar"])
    || firstText(localizedName, ["ar", "arabic"]);
  const frFull = firstText(record, ["fullNameFr", "nameFr", "nomCompletFr", "fullName", "displayName", "nomComplet", "french", "fr"])
    || firstText(localizedName, ["fr", "french"]);
  const arFirst = firstText(record, ["firstNameAr", "firstNameArabic", "givenNameAr", "prenomArbitreAr", "prenomAr", "prenomArabe"]);
  const arLast = firstText(record, ["lastNameAr", "lastNameArabic", "familyNameAr", "nomArbitreAr", "nomAr", "nomArabe"]);
  const frFirst = firstText(record, ["firstNameFr", "firstName", "givenName", "prenomArbitre", "prenom", "first_name"]);
  const frLast = firstText(record, ["lastNameFr", "lastName", "familyName", "nomArbitre", "nom", "last_name"]);
  const ar = arFull || [arFirst, arLast].filter(Boolean).join(" ") || "";
  const fr = [frFirst, frLast].filter(Boolean).join(" ") || frFull || firstText(record, ["name", "nom"]);
  return {
    ar: hasArabic(ar) ? ar : "",
    fr: hasArabic(fr) ? "" : fr
  };
}

function roleIndex(label: string): number | null {
  const key = normalizeKey(label).replace(/(?:arabic|french|ar|fr)$/, "");
  const numberedOfficial = key.match(/^(?:arbitre|referee)0?([1-4])$/);
  if (numberedOfficial) return Number(numberedOfficial[1]) - 1;
  if (/remplac|reserve|substitut|quatri|fourth|احتياط|بديل/.test(key) || /(?:arbitre|referee)(?:assistant)?0?4$/.test(key)) return 3;
  if (/deuxieme|second|2e|assistant2|adjoint2|الثاني|ثاني/.test(key) || /(?:arbitre|referee)(?:assistant|adjoint)?0?3$/.test(key)) return 2;
  if (/premier|first|1er|assistant1|adjoint1|الأول|اول/.test(key) || /(?:arbitre|referee)(?:assistant|adjoint)?0?2$/.test(key)) return 1;
  if (/^(?:arbitre|referee)0?1$/.test(key)) return 0;
  if (/assistant|adjoint/.test(key)) return 1;
  if (/principal|central|main|رئيس/.test(key) || /^(?:arbitre|referee|الحكم)$/.test(key)) return 0;
  return null;
}

const ARRAY_KEYS = [
  "arbitres", "referees", "refereeTeam", "refereeCrew", "refereeOfficials", "equipeArbitrale", "equipeArbitrage", "officielsArbitrage",
  "arbitresAssistants", "assistantsArbitres", "assistantReferees", "arbitreAssistants", "assistants", "adjoints", "arbitresRemplacants", "arbitresRemplaçants"
];
const ROLE_LABEL_KEYS = ["role", "roleName", "fonction", "libelle", "libelleFonction", "label", "type", "poste", "designation", "nomFonction", "roleArbitre"];

/** Reads the complete officiating crew, preserving role order and both EMS name variants. */
export function extractFafRefereeCrew(...records: unknown[]): FafRefereeCrew {
  const slots: RefereeNames[] = Array.from({ length: 4 }, () => ({ ar: "", fr: "" }));
  const fill = (index: number, person: unknown) => {
    if (index < 0 || index >= slots.length) return;
    const names = namesFrom(person);
    if (!slots[index]!.ar && names.ar) slots[index]!.ar = names.ar;
    if (!slots[index]!.fr && names.fr) slots[index]!.fr = names.fr;
  };

  const visited = new WeakSet<object>();
  const walk = (value: unknown, depth = 0, inheritedIndex: number | null = null): void => {
    if (!value || typeof value !== "object" || depth > 7 || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, depth + 1, inheritedIndex === null ? null : Math.min(3, inheritedIndex + index)));
      return;
    }
    if (inheritedIndex !== null) fill(inheritedIndex, value);
    const record = value as Record<string, unknown>;
    for (const [key, person] of Object.entries(record)) {
      const normalized = normalizeKey(key);
      const crewArray = ARRAY_KEYS.some((candidate) => normalizeKey(candidate) === normalized);
      if (crewArray && Array.isArray(person)) {
        const baseIndex = /assistant|adjoint/.test(normalized) ? 1 : /remplac|reserve|substitut/.test(normalized) ? 3 : 0;
        person.forEach((member, order) => {
          const memberRecord = member && typeof member === "object" ? member as Record<string, unknown> : null;
          const label = memberRecord ? firstText(memberRecord, ROLE_LABEL_KEYS) : "";
          const index = roleIndex(label) ?? Math.min(3, baseIndex + order);
          fill(index, member);
          walk(member, depth + 1, index);
        });
        continue;
      }
      if (/arbit|referee/iu.test(key)) {
        const index = roleIndex(key);
        if (Array.isArray(person)) {
          person.forEach((member, order) => {
            const memberRecord = member && typeof member === "object" ? member as Record<string, unknown> : null;
            const label = memberRecord ? firstText(memberRecord, ROLE_LABEL_KEYS) : "";
            const memberIndex = roleIndex(label) ?? Math.min(3, (index ?? 0) + order);
            fill(memberIndex, member);
            walk(member, depth + 1, memberIndex);
          });
          continue;
        }
        if (index !== null) fill(index, person);
        walk(person, depth + 1, index ?? inheritedIndex);
        continue;
      }
      const nestedRole = roleIndex(key);
      if (nestedRole !== null && /assistant|adjoint|principal|central|main|fourth|quatri|remplac|reserve|substitut/i.test(key)) {
        fill(nestedRole, person);
      }
      walk(person, depth + 1, nestedRole ?? inheritedIndex);
    }
  };
  records.forEach((record) => walk(record));

  const unique = (language: "ar" | "fr") => {
    const seen = new Set<string>();
    return slots.map((slot) => slot[language] || (language === "ar" && slot.fr ? transliterateRefereeName(slot.fr) : "")).filter((name) => {
      const key = normalizeKey(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  return { ar: unique("ar"), fr: unique("fr") };
}
