// TEST DOUBLE — used only by tests/finance (never imported by application code).
// NOT docxtemplater: a stand-in that replaces {{TOKEN}} in a utf8 buffer, so the ACTION's data flow can be tested.
export function renderTemplate(buffer: Buffer, data: Record<string, string>): Buffer {
  return Buffer.from(buffer.toString("utf8").replace(/\{\{([A-Z0-9_]+)\}\}/g, (_m, k) => data[k] ?? ""), "utf8");
}
export function detectPlaceholders(buffer: Buffer): string[] { return [...new Set([...buffer.toString("utf8").matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]!))]; }
