// Stub for the `server-only` build-time marker.
// The real package throws when loaded outside a Next.js server bundle, which is
// exactly what we want in production but blocks plain `node --test` runs of the
// pure server utilities (storage, date helpers, validators).
export {};
