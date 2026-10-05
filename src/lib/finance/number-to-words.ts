/**
 * Converts numbers into Arabic and French words for official club financial vouchers.
 * Formatted specifically for Algerian Dinars (DZD).
 */

export function amountToWordsArabic(amount: number): string {
  if (!amount || isNaN(amount)) return "صفر دينار جزائري";
  const num = Math.floor(Math.abs(amount));

  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  function convertGroup(n: number): string {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const parts: string[] = [];

    if (h > 0 && hundreds[h]) parts.push(hundreds[h]!);

    if (r > 0) {
      if (r < 10) {
        if (ones[r]) parts.push(ones[r]!);
      } else if (r < 20) {
        if (teens[r - 10]) parts.push(teens[r - 10]!);
      } else {
        const o = r % 10;
        const t = Math.floor(r / 10);
        if (o > 0 && ones[o] && tens[t]) {
          parts.push(`${ones[o]} و ${tens[t]}`);
        } else if (tens[t]) {
          parts.push(tens[t]!);
        }
      }
    }
    return parts.join(" و ");
  }

  if (num === 0) return "صفر دينار جزائري";

  const billions = Math.floor(num / 1000000000);
  const millions = Math.floor((num % 1000000000) / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  const result: string[] = [];

  if (billions > 0) {
    result.push(`${convertGroup(billions)} مليار`);
  }
  if (millions > 0) {
    if (millions === 1) result.push("مليون");
    else if (millions === 2) result.push("مليونان");
    else result.push(`${convertGroup(millions)} مليون`);
  }
  if (thousands > 0) {
    if (thousands === 1) result.push("ألف");
    else if (thousands === 2) result.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) result.push(`${convertGroup(thousands)} آلاف`);
    else result.push(`${convertGroup(thousands)} ألف`);
  }
  if (remainder > 0) {
    result.push(convertGroup(remainder));
  }

  return `${result.join(" و ")} دينار جزائري لا غير`;
}

export function amountToWordsFrench(amount: number): string {
  if (!amount || isNaN(amount)) return "Zéro dinar algérien";
  const num = Math.floor(Math.abs(amount));

  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingts", "quatre-vingt-dix"];

  function convertSmall(n: number): string {
    if (n === 0) return "";
    if (n < 10) return units[n] ?? "";
    if (n < 20) return teens[n - 10] ?? "";
    if (n < 70) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      if (u === 1) return `${tens[t] ?? ""} et un`;
      return u > 0 ? `${tens[t] ?? ""}-${units[u] ?? ""}` : (tens[t] ?? "");
    }
    if (n < 80) {
      const u = n % 10;
      if (u === 1) return `soixante et onze`;
      return `soixante-${teens[u] ?? ""}`;
    }
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (t === 8) {
      return u > 0 ? `quatre-vingt-${units[u] ?? ""}` : "quatre-vingts";
    }
    return `quatre-vingt-${teens[u] ?? ""}`;
  }

  function convertHundreds(n: number): string {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const parts: string[] = [];
    if (h === 1) parts.push("cent");
    else if (h > 1) parts.push(`${units[h] ?? ""} cent${r === 0 ? "s" : ""}`);
    if (r > 0) parts.push(convertSmall(r));
    return parts.join(" ");
  }

  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  const result: string[] = [];
  if (millions > 0) {
    result.push(millions === 1 ? "un million" : `${convertHundreds(millions)} millions`);
  }
  if (thousands > 0) {
    result.push(thousands === 1 ? "mille" : `${convertHundreds(thousands)} mille`);
  }
  if (remainder > 0) {
    result.push(convertHundreds(remainder));
  }

  const text = result.join(" ") || "zéro";
  const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
  return `${capitalized} dinars algériens`;
}
