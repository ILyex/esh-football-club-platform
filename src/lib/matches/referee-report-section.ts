const REPORT_HEADING = new RegExp(
  [
    // Arabic variations common in Algerian FAF / Ligue referee sheets
    "(?:ملاحظات|تقرير)\\s+(?:الحكم(?:\\s+النهائي)?|المباراة|اللقاء|المقابلة|التحكيم)",
    "(?:ملاحظات|الملاحظات)(?:\\s+العامة|\\s+حول\\s+سير\\s+(?:المباراة|المقابلة|اللقاء))?",
    "(?:أحداث|احداث)\\s+(?:المباراة|المقابلة|اللقاء)",
    "(?:التحفظات|تحفظات)",
    // French variations
    "rapport\\s+(?:du\\s+match|de\\s+match|de\\s+l['’]arbitre|d['’]arbitrage)(?:\\s+(?:final|officiel))?",
    "compte\\s+rendu\\s+(?:du\\s+match|de\\s+la\\s+rencontre)",
    "observations?(?:\\s+de\\s+l['’]arbitre|\\s+d['’]arbitrage)?",
    "remarques?(?:\\s+de\\s+l['’]arbitre)?",
    "incidents?",
    "r[eé]serves?",
    // English
    "match\\s+report"
  ].join("|"),
  "giu"
);

const FOOTER_SIGNATURE_PATTERN = /^(?:توقيع|إمضاء|امضاء|بصمة|ختم)\s+(?:الحكم|محافظ|المندوب|رئيس|الكاتب)|^(?:signature|le\\s+secrétaire|l['’]arbitre|le\\s+délégué|le\\s+commissaire)/iu;

/**
 * Checks whether text looks like a raw document dump (containing federation headers,
 * lineup tables, license columns) rather than a clean narrative report.
 */
export function isRawDocumentDump(text: string): boolean {
  if (!text || text.length < 120) return false;
  const dumpIndicators = [
    /FAF-EMS/i,
    /FEUILLE\s+DE\s+MATCH/i,
    /ورقة\s+المباراة/i,
    /LICENCE\s+N°/i,
    /رقم\s+(?:الإجازة|الاجازة|الرخصة)/i,
    /COMPOSITION\s+D[E']\s+[EÉ]QUIPE/i,
    /تشكيلة\s+الفريق/i,
    /Ligue\s+(?:Nationale|Régionale|de\s+Football|Wilaya)/i,
    /Fédération\s+Algérienne\s+de\s+Football/i,
    /الرابطة\s+(?:الولائية|الجهوية|الوطنية)/i,
    /الاتحاد\s+الجزائري\s+لكرة\s+القدم/i,
    /Dossard\s+Nom\s+Prénom/i
  ];
  let matches = 0;
  for (const indicator of dumpIndicators) {
    if (indicator.test(text)) matches++;
  }
  return matches >= 2 || (matches >= 1 && text.length > 700);
}

/**
 * FAF and Algerian league match reports contain match metadata and event tables
 * before their narrative observations. Return ONLY the narrative text following
 * the referee report heading at the bottom of the document.
 *
 * A missing heading returns null. It must NEVER copy the whole document into
 * the match report field.
 */
export function extractFinalMatchReportSection(documentText: string): string | null {
  if (!documentText) return null;
  const text = documentText.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  REPORT_HEADING.lastIndex = 0;

  let lastHeadingEnd = -1;
  let match: RegExpExecArray | null;
  while ((match = REPORT_HEADING.exec(text)) !== null) {
    const lineStart = text.lastIndexOf("\n", match.index - 1) + 1;
    const isStandaloneHeading = !text.slice(lineStart, match.index).trim();
    // In Algerian referee reports, the narrative section is located in the latter
    // portion of the sheet. Accept a standalone heading anywhere, or any heading
    // appearing past the first 25% of the text.
    if (isStandaloneHeading || match.index >= text.length * 0.25) {
      lastHeadingEnd = REPORT_HEADING.lastIndex;
    }
  }
  REPORT_HEADING.lastIndex = 0;

  if (lastHeadingEnd < 0) return null;

  const rawSection = text.slice(lastHeadingEnd).replace(/^\s*[:：\-–—]?\s*/, "");
  const lines = rawSection.split("\n");

  // Filter out page numbers and stop at footer signatures
  const contentLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\s*(?:page\s+)?\d+(?:\s*\/\s*\d+)?\s*$/iu.test(trimmed)) continue;
    if (FOOTER_SIGNATURE_PATTERN.test(trimmed)) break;
    contentLines.push(line);
  }

  const report = contentLines.join("\n").trim();
  if (!report || report.length < 3) return null;

  // If the extracted section still looks like a raw document dump (e.g. repeated tables), reject it
  if (isRawDocumentDump(report)) return null;

  return report;
}
