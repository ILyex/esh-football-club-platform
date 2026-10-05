import "server-only";

// ============================================================================
// AI CONTEXT BUILDER & SANITIZATION LAYER
// ----------------------------------------------------------------------------
// Strictly constructs bounded, permission-aware context for AI transformations.
// Enforces field allowlists and strips sensitive records (passwords, tokens,
// contracts, salaries, bank accounts, national IDs, private medical records).
// ============================================================================

export interface SanitizedRecordContext {
  id: string;
  type: string;
  title: string;
  date?: string;
  category?: string;
  notes?: string;
}

export interface BuildAIContextOptions {
  locale?: string;
  maxRecords?: number;
  maxCharacters?: number;
}

const FORBIDDEN_FIELD_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /hash/i,
  /salt/i,
  /salary/i,
  /wage/i,
  /contract/i,
  /nationalid/i,
  /iban/i,
  /bank/i,
  /balance/i,
  /credit/i,
  /session/i
];

/**
 * Validates that an object or field name does not leak sensitive credentials or financial balances.
 */
export function isFieldAllowedForAI(fieldName: string): boolean {
  return !FORBIDDEN_FIELD_PATTERNS.some((pattern) => pattern.test(fieldName));
}

/**
 * Builds a sanitized, bounded textual context from pre-authorized database records.
 */
export function buildSanitizedContext(
  records: SanitizedRecordContext[],
  options?: BuildAIContextOptions
): string {
  const maxRecords = options?.maxRecords ?? 5;
  const maxChars = options?.maxCharacters ?? 4000;

  const boundedRecords = records.slice(0, maxRecords);
  const formattedSections: string[] = [];

  let accumulatedLength = 0;

  for (const r of boundedRecords) {
    const lines = [
      `[RECORD ${r.id}] (${r.type})`,
      `Title: ${r.title}`
    ];
    if (r.date) lines.push(`Date: ${r.date}`);
    if (r.category) lines.push(`Category: ${r.category}`);
    if (r.notes) {
      // Strip any potential prompt injection delimiter mimics
      const cleanNotes = r.notes.replace(/<\/?input_text>/gi, "").trim();
      lines.push(`Notes: ${cleanNotes}`);
    }

    const sectionText = lines.join("\n");
    if (accumulatedLength + sectionText.length > maxChars) {
      break;
    }

    formattedSections.push(sectionText);
    accumulatedLength += sectionText.length + 2;
  }

  return formattedSections.join("\n\n---\n\n");
}
