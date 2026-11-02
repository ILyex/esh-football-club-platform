// TEST DOUBLE — used only by tests/finance (never imported by application code).
export const session: { user: any; invalid?: boolean } = { user: { id: "u1", name: "Test Super Admin", email: "t@x", roleKey: "super_admin", roleName: "Super Admin", permissions: ["*"] } };
export const signedOut = { value: false };

/** Auth.js entry point (kept for older test doubles). */
export async function auth() { return signedOut.value ? null : session; }

/**
 * The application reads the session through getRequestAuthSession() (a
 * react-cache() wrapper around auth()); the double must expose the same symbol
 * or every action under test throws
 * "(0, import_auth.getRequestAuthSession) is not a function".
 */
export const getRequestAuthSession = auth;
