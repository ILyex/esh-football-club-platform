import "server-only";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

// ============================================================================
// TEMPLATE ENGINE (spec sections 34–39: preserve the official document's
// design exactly — logo, header, footer, tables, typography, spacing — and
// only ever substitute the placeholder tokens inside it)
// ----------------------------------------------------------------------------
// docxtemplater edits the .docx's internal XML in place via PizZip; nothing
// about the file's layout, styles, or embedded images is touched except the
// literal {{PLACEHOLDER}} text runs. This is what makes "do not redesign the
// document" true at the implementation level, not just as a promise.
// ============================================================================

const DELIMITERS = { start: "{{", end: "}}" };
const PLACEHOLDER_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;

export class TemplateEngineError extends Error {}

/** Scans an uploaded .docx and returns the unique {{PLACEHOLDER}} tokens found in it (without the braces). */
export function detectPlaceholders(buffer: Buffer): string[] {
  let zip: PizZip;
  try {
    zip = new PizZip(buffer);
  } catch {
    throw new TemplateEngineError("الملف ليس مستندًا صالحًا بصيغة .docx");
  }

  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(zip, { delimiters: DELIMITERS, paragraphLoop: true, linebreaks: true });
  } catch {
    throw new TemplateEngineError("تعذّرت قراءة محتوى المستند");
  }

  const fullText = doc.getFullText();
  const found = new Set<string>();
  for (const match of fullText.matchAll(PLACEHOLDER_PATTERN)) {
    const token = match[1];
    if (token) found.add(token);
  }
  return Array.from(found).sort();
}

/**
 * Fills the template's placeholders with `data` and returns the generated
 * .docx as a Buffer. `data` must have a string entry for every placeholder
 * the caller intends to fill — anything left out renders as an empty
 * string rather than throwing, so a template can still be generated even if
 * a genuinely optional field (spec: "leave it empty") has no value.
 */
export function renderTemplate(buffer: Buffer, data: Record<string, string>): Buffer {
  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    delimiters: DELIMITERS,
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "" // missing/empty field -> blank, never a fabricated placeholder value
  });

  try {
    doc.render(data);
  } catch (error) {
    throw new TemplateEngineError(`فشل توليد المستند: ${error instanceof Error ? error.message : String(error)}`);
  }

  return doc.getZip().generate({ type: "nodebuffer" });
}
