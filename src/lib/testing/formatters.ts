/**
 * Consistent measurement and test score formatting utilities across the ESH testing engine.
 * Supports standard metrics: seconds (s), meters (m), centimeters (cm), VO2max (ml/kg/min), etc.
 */

export function formatMeasurement(
  value: number | string | null | undefined,
  unit?: string | null
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) {
    return String(value);
  }

  const u = (unit ?? "").trim();

  switch (u) {
    case "s":
      // Sprint & split times: 2 decimal places (e.g. "4.15 s")
      return `${num.toFixed(2)} s`;

    case "m":
      // Distance (Yo-Yo / aerobic runs): integer with comma grouping (e.g. "1,440 m")
      return `${Math.round(num).toLocaleString("en-US")} m`;

    case "cm":
      // Vertical jump & reach: 1 decimal place or integer (e.g. "48.5 cm")
      return `${Number.isInteger(num) ? num.toString() : num.toFixed(1)} cm`;

    case "ml/kg/min":
      // VO2max: 1 decimal place (e.g. "49.6 ml/kg/min")
      return `${num.toFixed(1)} ml/kg/min`;

    case "%":
      return `${Number.isInteger(num) ? num.toString() : num.toFixed(1)}%`;

    case "kg":
      return `${Number.isInteger(num) ? num.toString() : num.toFixed(1)} kg`;

    default:
      return u ? `${num} ${u}` : `${num}`;
  }
}

export function formatTestScore(
  primaryScore: number | null | undefined,
  primaryUnit?: string | null,
  secondaryScore?: number | null | undefined,
  secondaryUnit?: string | null
): string {
  if (primaryScore === null || primaryScore === undefined) {
    return "—";
  }

  const formattedPrimary = formatMeasurement(primaryScore, primaryUnit);
  if (secondaryScore !== null && secondaryScore !== undefined && secondaryUnit) {
    const formattedSecondary = formatMeasurement(secondaryScore, secondaryUnit);
    return `${formattedPrimary} (${formattedSecondary})`;
  }

  return formattedPrimary;
}
