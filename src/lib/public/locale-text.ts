/** Prevent Arabic-script content from silently appearing in French public UI. */
export function hasArabicScript(value: string | null | undefined): boolean {
  return Boolean(value && /[\u0600-\u06ff]/u.test(value));
}

export function frenchPublicText(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (/^(?:club\s+)?amal\s+sidi\s+hosni$/iu.test(value.trim())) {
    return value.replace(/\bAmal\b/iu, "Espoir");
  }
  if (!hasArabicScript(value)) return value;

  // Some older public records store both languages in one field. Prefer the
  // explicitly separated French half or a Latin-script name in parentheses.
  const separatedFrench = value.split(/[\/|]/).map((part) => part.trim()).find((part) => part && !hasArabicScript(part));
  if (separatedFrench) return separatedFrench;
  const frenchOutsideArabicAlias = value.replace(/\(([^()]*)\)/gu, (_whole, alias: string) => hasArabicScript(alias) ? " " : ` ${alias} `).trim();
  if (frenchOutsideArabicAlias && !hasArabicScript(frenchOutsideArabicAlias)) return frenchOutsideArabicAlias;
  if (/نادي\s+أمل\s+سيدي\s+حسني/u.test(value)) return "Club Espoir Sidi Hosni";
  if (/أمل\s+سيدي\s+حسني/u.test(value)) return "Association Sportive Espoir Sidi Hosni de Football";
  const latinAlias = value.match(/\(([^()]*)\)/u)?.[1]?.trim();
  if (latinAlias && !hasArabicScript(latinAlias)) return latinAlias;
  return fallback;
}

const FRENCH_CLUB_NAME_TRANSLATIONS: Record<string, string> = {
  "سريع عين مريم": "Rapide Aïn Meriem",
  "نجوم تيارت": "Étoile de Tiaret"
};

const ARABIC_CLUB_WORDS: Record<string, string> = {
  "نادي": "Club",
  "سريع": "Rapide",
  "نجوم": "Étoile de",
  "شبيبة": "Jeunesse sportive",
  "شباب": "Jeunesse",
  "مولودية": "Mouloudia",
  "اتحاد": "Union",
  "وفاق": "Entente",
  "أمل": "Espoir",
  "امل": "Espoir",
  "هلال": "Croissant",
  "ترجي": "Espérance",
  "اولمبي": "Olympique",
  "أولمبي": "Olympique",
  "عين": "Aïn",
  "تيارت": "Tiaret",
  "مريم": "Meriem",
  "وهران": "Oran",
  "الجزائر": "Alger"
};

function normalizeArabicClubName(value: string): string {
  return value.normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/gu, "").replace(/[أإآٱ]/gu, "ا").replace(/\s+/gu, " ").trim();
}

/** Transliterate Arabic-only opponent names for French displays when EMS has no French variant. */
function frenchClubNameFromArabic(value: string): string {
  const normalized = normalizeArabicClubName(value);
  const known = FRENCH_CLUB_NAME_TRANSLATIONS[normalized];
  if (known) return known;

  const words = normalized.split(/\s+/u).map((word) => ARABIC_CLUB_WORDS[word] ?? word);
  const transliteration: Record<string, string> = {
    ا: "a", ب: "b", ت: "t", ث: "th", ج: "dj", ح: "h", خ: "kh", د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "ch", ص: "s", ض: "d", ط: "t", ظ: "dh", ع: "", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "ou", ي: "i", ى: "a", ة: "a", ء: ""
  };
  return words.map((word) => [...word].map((character) => transliteration[character] ?? character).join("")).filter(Boolean).join(" ").replace(/\s+/gu, " ").trim();
}

/** Translate known competition names stored in Arabic before using a generic fallback. */
export function frenchCompetitionName(value: string | null | undefined): string {
  const name = value?.trim();
  if (!name) return "Compétition officielle";
  if (/شرفي/u.test(name)) return "Championnat d'honneur";
  if (/كأس\s*(?:الجزائر|الجمهورية)/u.test(name)) return "Coupe d'Algérie";
  if (/جهوي/u.test(name)) return "Championnat régional";
  if (/ولائي/u.test(name)) return "Championnat de wilaya";
  if (/^(?:المسابقة|البطولة)$/u.test(name)) return "Compétition officielle";
  return frenchPublicText(name, "Compétition officielle");
}

/** Display club/team names in the active UI language without changing stored data. */
export function localizedClubName(value: string | null | undefined, locale: string, fallback: string): string {
  const name = value?.trim();
  if (!name) return fallback;

  const parts = name.split(/[\/|]/u).map((part) => part.trim()).filter(Boolean);
  if (locale === "fr") {
    const frenchName = frenchPublicText(name, fallback);
    if (frenchName !== fallback) return frenchName;
    const variants = splitClubNameVariants(name);
    const arabicName = variants.ar || name;
    return hasArabicScript(arabicName) ? frenchClubNameFromArabic(arabicName) || fallback : arabicName || fallback;
  }

  const arabicParenthetical = name.match(/\(([^()]*)\)/u)?.[1]?.trim();
  if (arabicParenthetical && hasArabicScript(arabicParenthetical)) return arabicParenthetical;
  const arabicBaseName = name.replace(/\s*\([^()]*\)\s*/gu, " ").trim();
  if (hasArabicScript(arabicBaseName)) return arabicBaseName;
  const arabicPart = parts.find(hasArabicScript);
  if (arabicPart) return arabicPart.replace(/\s*\([^()]*\)\s*/gu, " ").trim() || fallback;
  if (/^(?:club\s+)?amal\s+sidi\s+hosni$/iu.test(name) || /espoir(?:e)?\s+sidi\s+hosni/iu.test(name)) {
    return "نادي أمل سيدي حسني";
  }
  // A Latin-only name has no Arabic translation in the record; prefer the
  // caller's translated category/context label instead of showing two scripts.
  return fallback;
}

/** Split legacy bilingual club values into editable language-specific fields. */
export function splitClubNameVariants(value: string | null | undefined): { ar: string; fr: string } {
  const name = value?.trim() ?? "";
  if (!name) return { ar: "", fr: "" };
  const parts = name.split(/[\/|]/u).map((part) => part.trim()).filter(Boolean);
  const parenthetical = name.match(/\(([^()]*)\)/u)?.[1]?.trim();
  const arabicParenthetical = parenthetical && hasArabicScript(parenthetical) ? parenthetical : "";
  const frenchParenthetical = parenthetical && !hasArabicScript(parenthetical) ? parenthetical : "";
  const arabicPart = parts.find(hasArabicScript);
  const ar = arabicParenthetical || arabicPart?.replace(/\s*\([^()]*\)\s*/gu, " ").trim() || name.replace(/\s*\([^()]*\)\s*/gu, " ").trim();
  const fr = frenchParenthetical || parts.find((part) => !hasArabicScript(part)) || "";
  return { ar, fr };
}

/** Store both official club names in one backwards-compatible field for existing match consumers. */
export function combineClubNameVariants(ar: string | null | undefined, fr: string | null | undefined): string {
  const arabic = ar?.trim() ?? "";
  const french = fr?.trim() ?? "";
  if (!arabic) return french;
  if (!french || normalizeClubName(arabic) === normalizeClubName(french)) return arabic;
  return `${arabic} (${french})`;
}

function normalizeClubName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function frenchPublicPersonName(person: {
  firstName?: string | null;
  lastName?: string | null;
  firstNameFr?: string | null;
  lastNameFr?: string | null;
}, fallback = "Joueur"): string {
  const frenchName = [person.firstNameFr, person.lastNameFr].filter(Boolean).join(" ").trim();
  if (frenchName) return frenchName;
  return frenchPublicText([person.firstName, person.lastName].filter(Boolean).join(" ").trim(), fallback);
}

/** Translate position categories and common football role abbreviations. */
export function localizedFootballPosition(value: string | null | undefined, locale: string): string {
  if (!value) return "";
  const normalized = value.trim().toUpperCase();
  const labels: Record<string, { ar: string; fr: string }> = {
    GOALKEEPER: { ar: "حارس المرمى", fr: "Gardien" },
    DEFENDER: { ar: "مدافع", fr: "Défenseur" },
    MIDFIELDER: { ar: "وسط", fr: "Milieu" },
    FORWARD: { ar: "مهاجم", fr: "Attaquant" },
    GK: { ar: "حارس", fr: "Gardien" },
    CB: { ar: "قلب دفاع", fr: "Défenseur central" },
    LB: { ar: "ظهير أيسر", fr: "Latéral gauche" },
    RB: { ar: "ظهير أيمن", fr: "Latéral droit" },
    DM: { ar: "وسط دفاعي", fr: "Milieu défensif" },
    CM: { ar: "وسط", fr: "Milieu" },
    AM: { ar: "وسط هجومي", fr: "Milieu offensif" },
    LW: { ar: "جناح أيسر", fr: "Ailier gauche" },
    RW: { ar: "جناح أيمن", fr: "Ailier droit" },
    ST: { ar: "مهاجم", fr: "Avant-centre" }
  };
  return labels[normalized]?.[locale === "ar" ? "ar" : "fr"] || value;
}

export function frenchPublicCategory(category: string | null | undefined): string {
  switch (category) {
    case "SENIOR": return "Séniors";
    case "U20": return "U20";
    case "U17": return "U17";
    case "U15": return "U15";
    default: return "Équipe";
  }
}

/** Localizes nationality values kept in older player records. */
export function frenchNationality(value: string | null | undefined): string {
  if (!value) return "Algérien";
  const normalized = value.trim().toLowerCase();
  const known: Record<string, string> = {
    "algeria": "Algérien", "algerian": "Algérien", "algérie": "Algérien", "algérienne": "Algérien", "algérien": "Algérien",
    "جزائرية": "Algérien", "جزائري": "Algérien", "الجزائرية": "Algérien", "الجزائري": "Algérien",
    "تونسية": "Tunisienne", "تونسي": "Tunisien", "مغربية": "Marocaine", "مغربي": "Marocain",
    "فرنسية": "Française", "فرنسي": "Français", "ليبية": "Libyenne", "ليبي": "Libyen",
    "موريتانية": "Mauritanienne", "موريتاني": "Mauritanien"
  };
  return known[normalized] || frenchPublicText(value, "Algérien");
}

/** Localizes nationality values regardless of whether the record uses Arabic, French, or English. */
export function arabicNationality(value: string | null | undefined): string {
  if (!value) return "جزائري";
  const normalized = value.trim().toLowerCase();
  const known: Record<string, string> = {
    "algeria": "جزائري", "algerian": "جزائري", "algérie": "جزائري", "algérienne": "جزائري", "algérien": "جزائري",
    "جزائرية": "جزائري", "جزائري": "جزائري", "الجزائرية": "جزائري", "الجزائري": "جزائري",
    "tunisia": "التونسية", "tunisian": "التونسية", "tunisie": "التونسية", "tunisienne": "التونسية", "تونسية": "التونسية", "تونسي": "التونسية",
    "morocco": "المغربية", "moroccan": "المغربية", "maroc": "المغربية", "marocaine": "المغربية", "مغربية": "المغربية", "مغربي": "المغربية",
    "france": "الفرنسية", "french": "الفرنسية", "française": "الفرنسية", "فرنسية": "الفرنسية", "فرنسي": "الفرنسية",
    "libya": "الليبية", "libyan": "الليبية", "libye": "الليبية", "libyenne": "الليبية", "ليبية": "الليبية", "ليبي": "الليبية",
    "mauritania": "الموريتانية", "mauritanian": "الموريتانية", "mauritanie": "الموريتانية", "موريتانية": "الموريتانية", "موريتاني": "الموريتانية"
  };
  return known[normalized] || value;
}

export function localizedNationality(value: string | null | undefined, locale: string): string {
  return locale === "ar" ? arabicNationality(value) : frenchNationality(value);
}
