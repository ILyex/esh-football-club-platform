/** Prevent Arabic-script content from silently appearing in French public UI. */
export function hasArabicScript(value: string | null | undefined): boolean {
  return Boolean(value && /[\u0600-\u06ff]/u.test(value));
}

export function frenchPublicText(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!hasArabicScript(value)) return value;

  // Some older public records store both languages in one field. Prefer the
  // explicitly separated French half or a Latin-script name in parentheses.
  const separatedFrench = value.split(/[\/|]/).map((part) => part.trim()).find((part) => part && !hasArabicScript(part));
  if (separatedFrench) return separatedFrench;
  if (/أمل\s+سيدي\s+حسني/u.test(value)) return "ESH Sidi Hosni";
  const latinAlias = value.match(/\(([^()]*)\)/u)?.[1]?.trim();
  if (latinAlias && !hasArabicScript(latinAlias)) return latinAlias;
  return fallback;
}

export function frenchPublicPersonName(person: {
  firstName?: string | null;
  lastName?: string | null;
  firstNameFr?: string | null;
  lastNameFr?: string | null;
}, fallback = "Joueur"): string {
  const frenchName = [person.firstNameFr, person.lastNameFr].filter(Boolean).join(" ").trim();
  if (frenchName) return frenchName;
  return frenchPublicText([person.firstName, person.lastName].filter(Boolean).join(" ").trim(), fallback);
}

export function frenchPublicCategory(category: string | null | undefined): string {
  switch (category) {
    case "SENIOR": return "Séniors";
    case "U20": return "U20";
    case "U17": return "U17";
    case "U15": return "U15";
    default: return "Équipe";
  }
}
