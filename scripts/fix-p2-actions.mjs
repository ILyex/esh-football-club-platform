/**
 * P2 fix script — rewrites the P2 sections of users/actions.ts and
 * staff/actions.ts with correct template literals, $transaction calls,
 * and fixes the i18n JSON files (remove BOM).
 *
 * Run: node scripts/fix-p2-actions.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, ".."); // project root

// ---------------------------------------------------------------------------
// Helper: strip BOM from string if present
// ---------------------------------------------------------------------------
function stripBom(str) {
  return str.charCodeAt(0) === 0xfeff ? str.slice(1) : str;
}

// ---------------------------------------------------------------------------
// 1. Fix users/actions.ts
// ---------------------------------------------------------------------------
const usersActionsPath = join(
  root, "src", "app", "[locale]", "(dashboard)", "dashboard", "users", "actions.ts"
);

const usersRaw = stripBom(readFileSync(usersActionsPath, "utf8"));

// Keep the original content up to (and not including) the P2 comment block
const P2_MARK = "// P2";
let usersCutIndex = usersRaw.indexOf("\n\n// ============================================================================\n// P2");
if (usersCutIndex === -1) usersCutIndex = usersRaw.indexOf("\n// P2");
const usersBase = (usersCutIndex === -1 ? usersRaw : usersRaw.slice(0, usersCutIndex)).trimEnd();

const usersP2 = `

// ============================================================================
// P2 — User Team Assignments (UserTeam)
// ----------------------------------------------------------------------------
// Authorization: users.manage — managing a user's team scope is a natural
// extension of managing that user.
//
// Safety:
//   - findUniqueOrThrow verifies the target user exists before any DB write.
//   - Upsert (not create): safe no-op if the assignment already exists at the
//     DB level (composite PK on UserTeam prevents duplicates regardless).
//   - deleteMany scoped to (userId, teamId): cannot affect another user.
//   - Both add AND remove bump tokenVersion in the SAME $transaction so the
//     new team scope takes effect on the user's very next request (JWT
//     invalidation), matching the pattern in updateUserAction above.
// ============================================================================

import { teamAssignmentSchema } from "@/lib/validations/team-assignment";

export async function addUserTeamAction(userId: string, formData: FormData) {
  const actor = await requirePermission("users.manage");

  const raw = Object.fromEntries(formData.entries());
  const parsed = teamAssignmentSchema.parse(raw);

  await db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true } });

  await db.$transaction([
    db.userTeam.upsert({
      where: { userId_teamId: { userId, teamId: parsed.teamId } },
      create: { userId, teamId: parsed.teamId },
      update: {} // already assigned — safe no-op
    }),
    db.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } })
  ]);

  await writeAuditLog({
    userId: actor.id,
    action: "user.team_assignment.add",
    entityType: "UserTeam",
    entityId: userId,
    changes: { teamId: parsed.teamId }
  });

  revalidatePath("/[locale]/dashboard/users", "page");
  revalidatePath(\`/[locale]/dashboard/users/\${userId}\`, "page");
}

export async function removeUserTeamAction(userId: string, teamId: string) {
  const actor = await requirePermission("users.manage");

  await db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true } });

  await db.$transaction([
    db.userTeam.deleteMany({ where: { userId, teamId } }),
    db.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } })
  ]);

  await writeAuditLog({
    userId: actor.id,
    action: "user.team_assignment.remove",
    entityType: "UserTeam",
    entityId: userId,
    changes: { teamId }
  });

  revalidatePath("/[locale]/dashboard/users", "page");
  revalidatePath(\`/[locale]/dashboard/users/\${userId}\`, "page");
}
`;

writeFileSync(usersActionsPath, usersBase + usersP2, "utf8");
console.log("users/actions.ts — lines:", (usersBase + usersP2).split("\n").length);

// ---------------------------------------------------------------------------
// 2. Fix staff/actions.ts
// ---------------------------------------------------------------------------
const staffActionsPath = join(
  root, "src", "app", "[locale]", "(dashboard)", "dashboard", "staff", "actions.ts"
);

const staffRaw = stripBom(readFileSync(staffActionsPath, "utf8"));
const staffHasTemplates = staffRaw.includes("`/[locale]/dashboard/staff/${staffId}`");
console.log("staff/actions.ts template literals present:", staffHasTemplates);

if (!staffHasTemplates) {
  let staffCutIndex = staffRaw.indexOf("\n\n// ============================================================================\n// P2");
  if (staffCutIndex === -1) staffCutIndex = staffRaw.indexOf("\n// P2");
  const staffBase = (staffCutIndex === -1 ? staffRaw : staffRaw.slice(0, staffCutIndex)).trimEnd();

  const staffP2 = `

// ============================================================================
// P2 — Staff Team Assignments (StaffTeam)
// ----------------------------------------------------------------------------
// Operational assignment — which teams a staff member works with day-to-day.
// Intentionally SEPARATE from UserTeam (authorization). Adding a StaffTeam
// row never grants any User access to anything. Policy (policy.ts) reads
// UserTeam only. Authorization: staff.update.
//
// NO tokenVersion bump: StaffTeam is not consulted for authorization.
// ============================================================================

import { teamAssignmentSchema as _teamAssignSchema } from "@/lib/validations/team-assignment";

export async function addStaffTeamAction(staffId: string, formData: FormData) {
  const actor = await requirePermission("staff.update");

  const raw = Object.fromEntries(formData.entries());
  const parsed = _teamAssignSchema.parse(raw);

  await db.staff.findUniqueOrThrow({ where: { id: staffId }, select: { id: true } });

  await db.staffTeam.upsert({
    where: { staffId_teamId: { staffId, teamId: parsed.teamId } },
    create: { staffId, teamId: parsed.teamId },
    update: {}
  });

  await writeAuditLog({
    userId: actor.id,
    action: "staff.team_assignment.add",
    entityType: "StaffTeam",
    entityId: staffId,
    changes: { teamId: parsed.teamId }
  });

  revalidatePath("/[locale]/dashboard/staff", "page");
  revalidatePath(\`/[locale]/dashboard/staff/\${staffId}\`, "page");
}

export async function removeStaffTeamAction(staffId: string, teamId: string) {
  const actor = await requirePermission("staff.update");

  await db.staff.findUniqueOrThrow({ where: { id: staffId }, select: { id: true } });

  await db.staffTeam.deleteMany({ where: { staffId, teamId } });

  await writeAuditLog({
    userId: actor.id,
    action: "staff.team_assignment.remove",
    entityType: "StaffTeam",
    entityId: staffId,
    changes: { teamId }
  });

  revalidatePath("/[locale]/dashboard/staff", "page");
  revalidatePath(\`/[locale]/dashboard/staff/\${staffId}\`, "page");
}
`;
  writeFileSync(staffActionsPath, staffBase + staffP2, "utf8");
  console.log("staff/actions.ts rewritten — lines:", (staffBase + staffP2).split("\n").length);
} else {
  console.log("staff/actions.ts already clean — no rewrite needed");
}

// ---------------------------------------------------------------------------
// 3. Fix i18n JSON files — strip BOM, validate, re-write
// ---------------------------------------------------------------------------
const arPath = join(root, "src", "i18n", "messages", "ar.json");
const frPath = join(root, "src", "i18n", "messages", "fr.json");

for (const [label, p] of [["ar.json", arPath], ["fr.json", frPath]]) {
  const raw = stripBom(readFileSync(p, "utf8"));
  const parsed = JSON.parse(raw); // will throw if malformed
  writeFileSync(p, JSON.stringify(parsed, null, 2), "utf8");
  console.log(label, "— teamAssignments keys:", Object.keys(parsed.teamAssignments).join(", "));
  console.log(label, "— common.remove:", parsed.common?.remove);
}

console.log("\nDone.");
