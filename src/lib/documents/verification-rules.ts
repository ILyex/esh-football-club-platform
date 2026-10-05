// ============================================================================
// DOCUMENT VERIFICATION RULES — pure, deterministic, no I/O, no AI.
// ----------------------------------------------------------------------------
// Given the TEXT of an uploaded document and the facts the platform already
// knows (the player it is filed under, the expense amount...), decide whether
// the document plausibly is what the uploader claims. The AI layer
// (src/lib/ai/document-verifier.ts) only ever supplies the text (PDF layer or
// vision OCR) and arbitrates ambiguous cases — every hard REJECT below is a
// plain, explainable rule, so it can be tested and never "hallucinated".
// ============================================================================

export type VerificationVerdict = "ACCEPT" | "REJECT" | "UNVERIFIED";

export interface VerificationFinding {
  /** Stable machine code, translated by the verifier for the viewer's locale. */
  code:
    | "OTHER_PLAYER"
    | "NAME_MISSING"
    | "NAME_UNCERTAIN"
    | "WRONG_DOCUMENT_TYPE"
    | "DRUG_TEST_POSITIVE"
    | "AMOUNT_MISMATCH"
    | "AMOUNT_NOT_FOUND"
    | "DATE_MISMATCH"
    | "PAYEE_MISSING"
    | "UNREADABLE"
    | "OK_NAME"
    | "OK_TYPE"
    | "OK_DRUG_TEST_NEGATIVE"
    | "OK_AMOUNT";
  severity: "error" | "warning" | "info";
  params?: Record<string, string | number>;
}

export interface RuleResult {
  verdict: VerificationVerdict;
  findings: VerificationFinding[];
  /** True when the rules could not decide and an AI arbiter may help. */
  needsArbiter: boolean;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Folds Arabic/French spelling variants so "أحمد"/"احمد", "Hôcine"/"hocine", "٢٠٢٦"/"2026" compare equal. */
export function normalizeText(input: string): string {
  return (input || "")
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // diacritics + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);
const hasLatin = (s: string) => /[a-z]/i.test(s);

function tokens(s: string): string[] {
  return normalizeText(s)
    .split(" ")
    .map((t) => t.replace(/^ال/, ""))
    .filter((t) => t.length >= 2);
}

export interface NameMatch {
  matched: number;
  total: number;
  ratio: number;
  /** Name and document use different scripts, so absence proves nothing. */
  scriptMismatch: boolean;
}

/** How many of the expected name's tokens occur in the document text. */
export function matchName(first: string, last: string, text: string): NameMatch {
  const want = tokens(`${first} ${last}`);
  const haystack = tokens(text);
  const set = new Set(haystack);
  let matched = 0;
  for (const w of want) {
    if (set.has(w) || haystack.some((h) => h.length >= 4 && w.length >= 4 && (h.includes(w) || w.includes(h)))) matched++;
  }
  const nameArabic = hasArabic(`${first}${last}`);
  const nameLatin = hasLatin(`${first}${last}`);
  const scriptMismatch = (nameArabic && !hasArabic(text) && hasLatin(text)) || (nameLatin && !nameArabic && hasArabic(text) && !hasLatin(text));
  return { matched, total: want.length, ratio: want.length ? matched / want.length : 0, scriptMismatch };
}

/** Every integer-looking amount in the text ("12 500,00", "12.500", "12500 DA"). */
export function extractAmounts(text: string): number[] {
  const t = text.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
  const found = new Set<number>();
  for (const m of t.matchAll(/\d[\d\s.,\u00A0\u202F]*\d|\d/g)) {
    const raw = m[0].replace(/[\s\u00A0\u202F]/g, "");
    // decimal part: ",00" / ".50" at the end
    const withoutDecimals = raw.replace(/[.,]\d{1,2}$/, "");
    const digits = withoutDecimals.replace(/[.,]/g, "");
    if (digits.length === 0 || digits.length > 12) continue;
    const n = Number(digits);
    if (Number.isFinite(n)) found.add(n);
  }
  return [...found];
}

const INSURANCE_KEYWORDS = [
  // Require explicit insurance terminology or a known insurer. Generic sports
  // words (league, federation, athlete) must never classify a roster/report as
  // an insurance certificate on their own.
  "تامين", "بوليصه تامين", "بوليصه", "شهاده تامين", "وثيقه تامين",
  "assurance", "insurance", "attestation d assurance", "certificat d assurance",
  "police d assurance", "contrat d assurance", "assurance sportive",
  "sports insurance", "insurance certificate", "souscripteur",
  "cnma", "saa", "caar", "cash assurance", "trust assurance", "gam assurance",
  "alliance assurance", "2a assurance"
];
const IDENTITY_KEYWORDS = ["بطاقه", "تعريف", "carte", "national", "identite", "identity", "passport", "passeport"];
const BIRTH_CERTIFICATE_KEYWORDS = ["شهاده ميلاد", "extrait de naissance", "acte de naissance", "birth certificate", "naissance"];
const CONTRACT_KEYWORDS = ["عقد", "contrat", "contract"];
const DIPLOMA_KEYWORDS = ["شهاده", "دبلوم", "diplome", "diploma", "qualification", "certificat"];
const DRUG_TEST_KEYWORDS = [
  "تحليل", "فحص", "مخدرات", "سموم", "مواد ممنوعة", "طبي", "مخبري", "depistage", "drogue", "drogues",
  "stupefiants", "toxicologique", "toxicol", "substances", "negatif", "positif", "negative", "positive"
];

export function looksLikeInsurance(text: string): boolean {
  const n = normalizeText(text);
  return INSURANCE_KEYWORDS.some((k) => n.includes(normalizeText(k)));
}

export function looksLikeIdentity(text: string): boolean {
  const n = normalizeText(text);
  return IDENTITY_KEYWORDS.some((k) => n.includes(normalizeText(k)));
}

export function looksLikeBirthCertificate(text: string): boolean {
  const n = normalizeText(text);
  return BIRTH_CERTIFICATE_KEYWORDS.some((k) => n.includes(normalizeText(k)));
}

export function looksLikeContract(text: string): boolean {
  const n = normalizeText(text);
  return CONTRACT_KEYWORDS.some((k) => n.includes(normalizeText(k)));
}

export function looksLikeDiploma(text: string): boolean {
  const n = normalizeText(text);
  return DIPLOMA_KEYWORDS.some((k) => n.includes(normalizeText(k)));
}

export function looksLikeDrugTest(text: string): boolean {
  const n = normalizeText(text);
  return DRUG_TEST_KEYWORDS.some((k) => n.includes(normalizeText(k)));
}

/** Evaluates drug test document results for negative/positive toxicological markers */
export function checkDrugTestDocument(args: {
  text: string | null;
  person: PlayerNameInfo;
  otherPersons?: Array<PlayerNameInfo>;
}): RuleResult {
  if (!isReadable(args.text)) return UNREADABLE;
  const text = args.text;
  const findings: VerificationFinding[] = [];
  const n = normalizeText(text);

  // Check document type
  if (!looksLikeDrugTest(text)) {
    findings.push({ code: "WRONG_DOCUMENT_TYPE", severity: "error" });
    return { verdict: "REJECT", findings, needsArbiter: false };
  } else {
    findings.push({ code: "OK_TYPE", severity: "info" });
  }

  // Check name match
  const own = matchPlayerName(args.person, text);
  const fullName = `${args.person.firstName} ${args.person.lastName}`.trim();
  const ownFull = own.total > 0 && own.matched === own.total;

  if (ownFull) {
    findings.push({ code: "OK_NAME", severity: "info", params: { name: fullName } });
  } else if (args.otherPersons && args.otherPersons.length > 0) {
    const other = args.otherPersons.find((o) => {
      const m = matchPlayerName(o, text);
      return m.total >= 2 && m.matched === m.total;
    });
    if (other && own.ratio < 1) {
      const otherDisplayName = `${other.firstName} ${other.lastName}`.trim();
      findings.push({ code: "OTHER_PLAYER", severity: "error", params: { other: otherDisplayName, name: fullName } });
    } else if (own.scriptMismatch) {
      findings.push({ code: "NAME_UNCERTAIN", severity: "warning", params: { name: fullName } });
    } else {
      findings.push({ code: "NAME_MISSING", severity: "error", params: { name: fullName } });
    }
  } else if (own.scriptMismatch) {
    findings.push({ code: "NAME_UNCERTAIN", severity: "warning", params: { name: fullName } });
  } else {
    findings.push({ code: "NAME_MISSING", severity: "error", params: { name: fullName } });
  }

  // Check drug test result: positive vs negative
  const positiveTerms = ["ايجابي", "ايجابيه", "موجب", "positif", "positive", "detecte", "presence", "reactif", "reactive"];
  const negativeTerms = ["سلبي", "سلبيه", "negatif", "negative", "non detecte", "non reactive", "absence", "غياب", "غير موجود", "غير مكتشف", "سليم", "خال"];

  const hasPositive = positiveTerms.some((t) => n.includes(normalizeText(t)));
  const hasNegative = negativeTerms.some((t) => n.includes(normalizeText(t)));

  if (hasPositive && hasNegative) {
    findings.push({ code: "UNREADABLE", severity: "warning" });
    return findings.some((f) => f.severity === "error")
      ? { verdict: "REJECT", findings, needsArbiter: false }
      : { verdict: "UNVERIFIED", findings, needsArbiter: true };
  }

  if (hasPositive) {
    findings.push({ code: "DRUG_TEST_POSITIVE", severity: "error" });
    return { verdict: "REJECT", findings, needsArbiter: false };
  }

  if (findings.some((f) => f.severity === "error")) {
    return { verdict: "REJECT", findings, needsArbiter: false };
  }

  if (hasNegative && !findings.some((f) => f.code === "NAME_UNCERTAIN")) {
    findings.push({ code: "OK_DRUG_TEST_NEGATIVE", severity: "info" });
    return { verdict: "ACCEPT", findings, needsArbiter: false };
  }

  // If unclear, request arbiter review
  return { verdict: "UNVERIFIED", findings, needsArbiter: true };
}

/** Minimum characters for a document to count as "readable" evidence. */
export const MIN_READABLE_CHARS = 25;

export function isReadable(text: string | null | undefined): text is string {
  return !!text && normalizeText(text).replace(/\s/g, "").length >= MIN_READABLE_CHARS;
}

const UNREADABLE: RuleResult = {
  verdict: "UNVERIFIED",
  findings: [{ code: "UNREADABLE", severity: "warning" }],
  needsArbiter: false
};

export interface PlayerNameInfo {
  firstName: string;
  lastName: string;
  firstNameFr?: string | null;
  lastNameFr?: string | null;
}

/** Matches player name using both Arabic and French names */
export function matchPlayerName(player: PlayerNameInfo, text: string): NameMatch {
  const ar = matchName(player.firstName, player.lastName, text);
  if (ar.total > 0 && ar.matched === ar.total) {
    return ar;
  }

  if (player.firstNameFr && player.lastNameFr) {
    const fr = matchName(player.firstNameFr, player.lastNameFr, text);
    if (fr.total > 0 && fr.matched === fr.total) {
      return fr;
    }
    if (fr.ratio > ar.ratio) {
      return fr;
    }
  }

  return ar;
}

// ---------------------------------------------------------------------------
// Player-bound documents (insurance, ID, birth certificate, contract)
// ---------------------------------------------------------------------------
export function checkPlayerDocument(args: {
  text: string | null;
  player: PlayerNameInfo;
  otherPlayers: Array<PlayerNameInfo>;
  kind: "INSURANCE" | "IDENTITY" | "CONTRACT" | "BIRTH_CERTIFICATE" | "DIPLOMA";
}): RuleResult {
  if (!isReadable(args.text)) return UNREADABLE;
  const text = args.text;
  const findings: VerificationFinding[] = [];
  const own = matchPlayerName(args.player, text);
  const fullName = `${args.player.firstName} ${args.player.lastName}`.trim();

  // 1. Is it the right KIND of document?
  const typeOk = args.kind === "INSURANCE"
    ? looksLikeInsurance(text)
    : args.kind === "CONTRACT"
      ? looksLikeContract(text)
      : args.kind === "BIRTH_CERTIFICATE"
        ? looksLikeBirthCertificate(text)
        : args.kind === "DIPLOMA"
          ? looksLikeDiploma(text)
          : looksLikeIdentity(text);
  if (!typeOk) {
    findings.push({ code: "WRONG_DOCUMENT_TYPE", severity: "error" });
  } else {
    findings.push({ code: "OK_TYPE", severity: "info" });
  }

  // 2. Is it THIS player? Strong evidence = full name (Arabic or French);
  //    or a different player's full name present while ours is not.
  const ownFull = own.total > 0 && own.matched === own.total;
  if (ownFull) {
    findings.push({ code: "OK_NAME", severity: "info", params: { name: fullName } });
  } else {
    const other = args.otherPlayers.find((o) => {
      const m = matchPlayerName(o, text);
      return m.total >= 2 && m.matched === m.total;
    });
    if (other && own.ratio < 1) {
      const otherDisplayName = `${other.firstName} ${other.lastName}`.trim();
      findings.push({ code: "OTHER_PLAYER", severity: "error", params: { other: otherDisplayName, name: fullName } });
    } else if (own.scriptMismatch) {
      findings.push({ code: "NAME_UNCERTAIN", severity: "warning", params: { name: fullName } });
    } else if (own.ratio === 0) {
      findings.push({ code: "NAME_MISSING", severity: "error", params: { name: fullName } });
    } else {
      // partial (e.g. only the family name matches) — not decisive
      findings.push({ code: "NAME_UNCERTAIN", severity: "warning", params: { name: fullName } });
    }
  }

  const hasError = findings.some((f) => f.severity === "error");
  const uncertain = findings.some((f) => f.code === "NAME_UNCERTAIN");
  if (hasError) return { verdict: "REJECT", findings, needsArbiter: false };
  if (uncertain) return { verdict: "UNVERIFIED", findings, needsArbiter: true };
  return { verdict: "ACCEPT", findings, needsArbiter: false };
}

// ---------------------------------------------------------------------------
// Expense justification (invoice / receipt)
// ---------------------------------------------------------------------------
export function checkExpenseReceipt(args: {
  text: string | null;
  amount: number;
  date?: Date | null;
  payeeName?: string | null;
}): RuleResult {
  if (!isReadable(args.text)) return UNREADABLE;
  const text = args.text;
  const findings: VerificationFinding[] = [];

  const amounts = extractAmounts(text);
  if (amounts.length === 0) {
    findings.push({ code: "AMOUNT_NOT_FOUND", severity: "warning", params: { amount: args.amount } });
  } else if (amounts.includes(args.amount)) {
    findings.push({ code: "OK_AMOUNT", severity: "info", params: { amount: args.amount } });
  } else {
    // A receipt that shows figures but never the recorded amount does not justify this expense.
    findings.push({ code: "AMOUNT_MISMATCH", severity: "error", params: { amount: args.amount } });
  }

  if (args.date) {
    const n = text.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
    const years = [...n.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
    const expYear = args.date.getUTCFullYear();
    if (years.length > 0 && !years.some((y) => Math.abs(y - expYear) <= 1)) {
      findings.push({ code: "DATE_MISMATCH", severity: "warning", params: { year: expYear } });
    }
  }

  if (args.payeeName && args.payeeName.trim().length >= 3) {
    const m = matchName(args.payeeName, "", text);
    if (m.ratio === 0 && !m.scriptMismatch) findings.push({ code: "PAYEE_MISSING", severity: "warning", params: { payee: args.payeeName } });
  }

  if (findings.some((f) => f.severity === "error")) return { verdict: "REJECT", findings, needsArbiter: false };
  const ambiguous = findings.some((f) => f.code === "AMOUNT_NOT_FOUND");
  return { verdict: ambiguous ? "UNVERIFIED" : "ACCEPT", findings, needsArbiter: ambiguous };
}
