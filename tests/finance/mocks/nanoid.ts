// TEST DOUBLE — used only by tests/finance (never imported by application code).
let n = 0;
export function nanoid(len = 8): string { n++; return (n.toString(36).padStart(len, "0")).slice(-len); }
