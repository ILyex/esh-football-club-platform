const REFEREE_ROLES = {
  ar: ["الحكم الرئيسي", "حكم التماس الأول", "حكم التماس الثاني", "الحكم الاحتياطي"],
  fr: ["Arbitre principal", "Premier arbitre assistant", "Deuxième arbitre assistant", "Arbitre remplaçant"]
} as const;

export function splitRefereeNames(value: string | null | undefined): string[] {
  return (value ?? "").split(/[,،]/).map((name) => name.trim()).filter(Boolean).slice(0, 4);
}

const ARABIC_REFEREE_NAMES: Record<string, string> = {
  abdelkader: "عبد القادر", "abdel kader": "عبد القادر", mohamed: "محمد", mohammed: "محمد",
  mustapha: "مصطفى", moustapha: "مصطفى", abdelaziz: "عبد العزيز", abdellah: "عبد الله",
  abdallah: "عبد الله", hocine: "حسين", youcef: "يوسف", yacine: "ياسين", amine: "أمين",
  hadjar: "حجار", hadj: "حاج", haddad: "حداد", ben: "بن", bounab: "بوناب"
};

/** Best-effort Arabic transliteration for Latin-only official names from EMS. */
export function transliterateRefereeName(value: string): string {
  if (/[\u0600-\u06FF]/u.test(value)) return value.trim();
  return value.trim().split(/\s+/).map((token) => {
    const key = token.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
    if (ARABIC_REFEREE_NAMES[key]) return ARABIC_REFEREE_NAMES[key]!;
    return key
      .replace(/ch/g, "ش").replace(/dj/g, "ج").replace(/ou/g, "و")
      .replace(/kh/g, "خ").replace(/gh/g, "غ").replace(/ph/g, "ف")
      .replace(/th/g, "ث").replace(/ss/g, "س")
      .replace(/c(?=[eiy])/g, "س").replace(/c/g, "ك").replace(/g(?=[eiy])/g, "ج")
      .replace(/g/g, "غ").replace(/j/g, "ج").replace(/q/g, "ق")
      .replace(/w/g, "و").replace(/y/g, "ي").replace(/x/g, "كس")
      .replace(/a/g, "ا").replace(/e/g, "ي").replace(/i/g, "ي")
      .replace(/o/g, "و").replace(/u/g, "و").replace(/h/g, "ه")
      .replace(/b/g, "ب").replace(/d/g, "د").replace(/f/g, "ف")
      .replace(/k/g, "ك").replace(/l/g, "ل").replace(/m/g, "م")
      .replace(/n/g, "ن").replace(/p/g, "ب").replace(/r/g, "ر")
      .replace(/s/g, "س").replace(/t/g, "ت").replace(/v/g, "ف")
      .replace(/z/g, "ز").replace(/[^\u0600-\u06FF]/g, "");
  }).filter(Boolean).join(" ");
}

export function arabicRefereeNames(arabic: string | null | undefined, french: string | null | undefined, fallback?: string | null): string {
  const arabicNames = splitRefereeNames(arabic);
  if (arabicNames.some((name) => /[\u0600-\u06FF]/u.test(name))) {
    return arabicNames.map(transliterateRefereeName).join("، ");
  }
  const names = splitRefereeNames(arabic || french || fallback);
  return names.map(transliterateRefereeName).filter(Boolean).join("، ");
}

export function getRefereeRoleLabel(index: number, locale: string): string {
  const roles = locale === "ar" ? REFEREE_ROLES.ar : REFEREE_ROLES.fr;
  return roles[index] ?? roles[3];
}
