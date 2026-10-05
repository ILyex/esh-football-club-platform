// TEST DOUBLE — used only by tests/rbac (never imported by application code).
// Minimal in-memory implementation of the AuthzPrismaClient surface that
// src/lib/authz/policy.ts actually declares it needs — nothing more, so a
// change to this mock's shape immediately shows if policy.ts's assumed
// surface has drifted from what it imports.

export type RoleRow = { key: string; teamScoped: boolean };
export type UserTeamRow = { userId: string; teamId: string };

export const store: { roles: RoleRow[]; userTeams: UserTeamRow[] } = { roles: [], userTeams: [] };

export function reset(): void {
  store.roles = [];
  store.userTeams = [];
}

export const db = {
  role: {
    async findUnique({ where }: { where: { key: string } }) {
      const row = store.roles.find((r) => r.key === where.key);
      return row ? { teamScoped: row.teamScoped } : null;
    }
  },
  userTeam: {
    async findMany({ where }: { where: { userId: string } }) {
      return store.userTeams.filter((r) => r.userId === where.userId).map((r) => ({ teamId: r.teamId }));
    }
  }
};
