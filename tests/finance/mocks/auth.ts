// TEST DOUBLE — used only by tests/finance (never imported by application code).
export const session: { user: any; invalid?: boolean } = { user: { id: "u1", name: "Test Super Admin", email: "t@x", roleKey: "super_admin", roleName: "Super Admin", permissions: ["*"] } };
export const signedOut = { value: false };
export async function auth() { return signedOut.value ? null : session; }
