/** Prevent Arabic-script content from silently appearing in French public UI. */
export function hasArabicScript(value: string | null | undefined): boolean {
  return Boolean(value && /[\u0600-\u06ff]/u.test(value));
}

export function frenchPublicText(value: string | null | undefined, fallback: string): string {
  return value && !hasArabicScript(value) ? value : fallback;
}
