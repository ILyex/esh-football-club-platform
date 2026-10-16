/** Format match date/time in a stable LTR numeric form to prevent RTL reordering. */
export function formatAlgeriaDateTime(date: Date | string, locale: string) {
  const value = typeof date === "string" ? new Date(date) : date;
  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Algiers"
  }).format(value);
  return `${datePart} ${formatAlgeriaTime(value, locale)}`;
}

/** Format a match kickoff in Algeria using a stable 24-hour clock. */
export function formatAlgeriaTime(date: Date | string, locale: string) {
  const intlLocale = locale === "ar" ? "ar-DZ-u-nu-latn" : "fr-DZ";
  return new Intl.DateTimeFormat(intlLocale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Algiers",
    hourCycle: "h23"
  }).format(typeof date === "string" ? new Date(date) : date);
}
