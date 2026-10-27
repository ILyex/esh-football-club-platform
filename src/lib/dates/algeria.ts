/** Format a date in Algeria as DD/MM/YYYY, isolated from surrounding RTL text. */
export function formatAlgeriaDate(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Algiers"
  }).format(value);
}

/** Format match date/time in a stable LTR numeric form to prevent RTL reordering. */
export function formatAlgeriaDateTime(date: Date | string, locale: string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return `${formatAlgeriaDate(value)} ${formatAlgeriaTime(value, locale)}`;
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

/** Convert an Algeria-local calendar date and HH:mm time into an absolute instant. */
export function combineAlgeriaDateAndTime(date: Date | string, time: string): Date {
  const dateText = typeof date === "string" ? date.trim() : "";
  const dateParts = dateText.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dateValue = typeof date === "string" ? new Date(date) : date;
  const year = dateParts ? Number(dateParts[1]) : dateValue.getUTCFullYear();
  const month = dateParts ? Number(dateParts[2]) : dateValue.getUTCMonth() + 1;
  const day = dateParts ? Number(dateParts[3]) : dateValue.getUTCDate();
  const timeParts = time.match(/^(\d{2}):(\d{2})$/);
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31 || !timeParts) return new Date(Number.NaN);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return new Date(Number.NaN);

  const hour = Number(timeParts[1]);
  const minute = Number(timeParts[2]);
  if (hour > 23 || minute > 59) return new Date(Number.NaN);

  const desiredWallTime = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  // Iteratively account for the timezone offset without relying on the host machine's timezone.
  let instant = desiredWallTime;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
    const observedWallTime = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    const correction = desiredWallTime - observedWallTime;
    if (correction === 0) break;
    instant += correction;
  }
  return new Date(instant);
}

/** Format any displayed date/time in the club's timezone with a 24-hour clock. */
export function formatAlgeriaDateTimeLocalized(
  date: Date | string,
  locale: string,
  options: Intl.DateTimeFormatOptions
) {
  const intlLocale = locale === "ar" ? "ar-DZ-u-ca-gregory-nu-latn" : "fr-DZ";
  return new Intl.DateTimeFormat(intlLocale, {
    ...options,
    timeZone: "Africa/Algiers",
    hourCycle: "h23"
  }).format(typeof date === "string" ? new Date(date) : date);
}
