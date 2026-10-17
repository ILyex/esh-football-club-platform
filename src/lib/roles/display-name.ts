/** Stable built-in role names, matching the canonical role definitions. */
export function roleDisplayName(roleKey: string, storedName: string): string {
  if (roleKey === "super_admin") return "Super Admin";
  if (roleKey === "developer") return "DEV";
  return storedName;
}
