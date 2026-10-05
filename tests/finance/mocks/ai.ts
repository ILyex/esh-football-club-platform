// TEST DOUBLE — used only by tests/finance (never imported by application code).
export const aiCalls: string[] = [];
export function isAIConfigured() { return true; }
export async function formalizeText(t: string) { aiCalls.push(t); return `AI:${t}`; }
