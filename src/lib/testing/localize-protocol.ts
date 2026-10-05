type ProtocolTranslationField = "name" | "description";

export function localizeTestProtocol(
  translate: (key: string) => string,
  code: string,
  field: ProtocolTranslationField,
  fallback: string
): string {
  try {
    return translate(`protocols.definitions.${code}.${field}`);
  } catch {
    return fallback;
  }
}
