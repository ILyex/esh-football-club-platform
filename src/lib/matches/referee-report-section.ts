const REPORT_HEADING = /تقرير\s+(?:المباراة|الحكم(?:\s+النهائي)?|اللقاء)|rapport\s+(?:du\s+match|de\s+match|de\s+l['’]arbitre|d['’]arbitrage)(?:\s+(?:final|officiel))?|compte\s+rendu\s+(?:du\s+match|de\s+la\s+rencontre)|match\s+report/giu;

/**
 * FAF's final report PDF contains match metadata and event tables before its
 * narrative report. Return only the text following the last report heading.
 * A missing heading is treated as unreadable rather than as permission to
 * copy the whole document into the match report.
 */
export function extractFinalMatchReportSection(documentText: string): string | null {
  const text = documentText.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  REPORT_HEADING.lastIndex = 0;

  let lastHeadingEnd = -1;
  let match: RegExpExecArray | null;
  while ((match = REPORT_HEADING.exec(text)) !== null) {
    const lineStart = text.lastIndexOf("\n", match.index - 1) + 1;
    const isStandaloneHeading = !text.slice(lineStart, match.index).trim();
    // Some PDF text layers flatten the heading and the narrative onto one
    // line. Since FAF places this section at the end, accept a late heading
    // even when the PDF extractor lost the line break.
    if (isStandaloneHeading || match.index >= text.length * 0.3) {
      lastHeadingEnd = REPORT_HEADING.lastIndex;
    }
  }
  REPORT_HEADING.lastIndex = 0;

  if (lastHeadingEnd < 0) return null;

  const report = text.slice(lastHeadingEnd)
    .replace(/^\s*[:：\-–—]?\s*/, "")
    .split("\n")
    .filter((line) => !/^\s*(?:page\s+)?\d+(?:\s*\/\s*\d+)?\s*$/iu.test(line))
    .join("\n")
    .trim();
  return report || null;
}
