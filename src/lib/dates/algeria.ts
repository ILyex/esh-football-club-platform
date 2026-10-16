/** Format an absolute timestamp using Algeria's local time and a 24-hour clock. */
export function formatAlgeriaDateTime(date: Date | string, locale: string, dateStyle: Intl.DateTimeFormatOptions["dateStyle"] = "medium") {
  const intlLocale = locale === "ar" ? "ar-DZ-u-ca-gregory-nu-latn" : "fr-DZ";
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle,
    timeStyle: "short",
    timeZone: "Africa/Algiers",
    hourCycle: "h23"
  }).format(typeof date === "string" ? new Date(date) : date);
}
