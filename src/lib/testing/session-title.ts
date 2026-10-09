export function compactTestSessionTitle(title: string, teamName?: string | null, protocolCode?: string): string {
  let compact = title.trim();
  const separators = [" — ", " – ", " - "];

  if (teamName) {
    for (const separator of separators) {
      const suffix = `${separator}${teamName.trim()}`;
      if (compact.endsWith(suffix)) {
        compact = compact.slice(0, -suffix.length).trim();
        break;
      }
    }
  }

  compact = compact
    .replace(/^(اختبار\s+){2,}/u, "اختبار ")
    .replace(/^(Évaluation\s+){2,}/iu, "Évaluation ");

  if (protocolCode === "YOYO_IR1" || protocolCode === "YOYO_IR2") {
    const version = protocolCode === "YOYO_IR2" ? "IR2" : "IR1";
    if (!/\bIR[12]\b/i.test(compact)) compact = `${compact} ${version}`;
  }

  return compact || title.trim();
}
