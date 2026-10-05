import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// ============================================================================
// SHARED TRANSACTION HELPERS FOR THE FINANCE MODULE
// ----------------------------------------------------------------------------
// One definition of "what is a serialization conflict" and "what is a unique
// violation", plus a SERIALIZABLE transaction wrapper for finance writes that
// are NOT ledger movements (budgets, expenses). Ledger movements keep their
// own loop inside treasury-service.ts because their retry policy re-throws
// FinanceError codes; both use the two predicates below.
// ============================================================================

export const MAX_SERIALIZATION_RETRIES = 3;

/** Postgres SQLSTATE 40001 / 40P01, surfaced by Prisma as P2034 for interactive transactions. */
export function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

/** Prisma P2002: a @unique column rejected the write — the database-level backstop behind every pre-check. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Runs `fn` in a SERIALIZABLE interactive transaction. On a serialization
 * conflict the WHOLE callback is re-run (so every read is fresh) a bounded
 * number of times; if it still conflicts the caller gets the stable domain
 * code CONCURRENT_UPDATE instead of a raw database error. Any other error
 * (including the Error("<CODE>") the callbacks throw for rejected rules) is
 * propagated untouched and never retried.
 */
export async function financeSerializableTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isSerializationConflict(error)) throw error;
      if (attempt === MAX_SERIALIZATION_RETRIES - 1) throw new Error("CONCURRENT_UPDATE");
    }
  }
  throw new Error("CONCURRENT_UPDATE"); // unreachable; satisfies definite return
}
