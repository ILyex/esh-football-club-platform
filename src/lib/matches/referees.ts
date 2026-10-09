const REFEREE_ROLES = {
  ar: ["الحكم الرئيسي", "حكم التماس الأول", "حكم التماس الثاني", "الحكم الاحتياطي"],
  fr: ["Arbitre principal", "Premier arbitre assistant", "Deuxième arbitre assistant", "Arbitre remplaçant"]
} as const;

export function splitRefereeNames(value: string | null | undefined): string[] {
  return (value ?? "").split(/[,،]/).map((name) => name.trim()).filter(Boolean).slice(0, 4);
}

export function getRefereeRoleLabel(index: number, locale: string): string {
  const roles = locale === "ar" ? REFEREE_ROLES.ar : REFEREE_ROLES.fr;
  return roles[index] ?? roles[3];
}
