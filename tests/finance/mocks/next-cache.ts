// TEST DOUBLE — used only by tests/finance (never imported by application code).
export const revalidated: string[] = [];
export function revalidatePath(p: string) { revalidated.push(p); }
