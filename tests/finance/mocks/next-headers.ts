// TEST DOUBLE — used only by tests/finance (never imported by application code).
export async function headers(): Promise<never> { throw new Error("no request context"); }
export async function cookies(): Promise<never> { throw new Error("no request context"); }
