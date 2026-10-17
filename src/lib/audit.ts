import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { getDeploymentEnvironment } from "@/lib/deployment-environment";

// ============================================================================
// AUDIT LOG (spec section 42)
// ----------------------------------------------------------------------------
// Call this from every Server Action / Route Handler that creates, edits,
// deletes, publishes, or VIEWS sensitive data (e.g. downloading a restricted
// document). There is deliberately no updateAuditLog / deleteAuditLog
// export — log rows are append-only from the application's point of view.
// In production, additionally REVOKE UPDATE, DELETE ON "AuditLog" FROM
// the application's database role, and grant it only via a separate,
// break-glass admin connection.
// ============================================================================

/**
 * `client` lets a caller write the audit row INSIDE its own database
 * transaction (pass the `tx` of `db.$transaction`). Money-changing finance
 * operations do this so the mutation and its mandatory audit record commit or
 * roll back together — a committed financial change can never lack its audit
 * row, and a failed audit insert rolls the change back. Callers that omit it
 * get the previous behaviour (a standalone write on the shared client).
 */
export async function writeAuditLog(
  entry: {
    userId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    changes?: Record<string, unknown>;
  },
  client: { auditLog: Prisma.TransactionClient["auditLog"] } = db
) {
  let ipAddress: string | null = null;
  try {
    const h = await headers();
    ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  } catch {
    // headers() is unavailable outside a request context (e.g. seed script) — fine to skip.
  }

  await client.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      changes: entry.changes as any,
      deploymentEnvironment: getDeploymentEnvironment(),
      ipAddress
    }
  });
}
