// TEST DOUBLE — used only by tests/finance (never imported by application code).
export class Redirect extends Error { constructor(public url: string) { super(`REDIRECT ${url}`); this.name = "Redirect"; } }
export function redirect(url: string): never { throw new Redirect(url); }
export function notFound(): never { throw new Error("NOT_FOUND"); }
