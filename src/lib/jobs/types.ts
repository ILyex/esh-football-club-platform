import type { JobStatus, JobPriority } from "@prisma/client";

export type { JobStatus, JobPriority };

// ============================================================================
// P5 — BACKGROUND JOBS: CORE TYPES & STATE MACHINE
// ============================================================================

export const VALID_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["SUCCEEDED", "RETRYING", "FAILED"],
  RETRYING: ["RUNNING", "CANCELLED", "FAILED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: []
};

export function isValidTransition(from: JobStatus, to: JobStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface JobRecord<TPayload = unknown> {
  id: string;
  type: string;
  payload: TPayload;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  nextRetryAt: Date | null;
  lockedBy: string | null;
  lockedUntil: Date | null;
  lastError: string | null;
  errorDetails: unknown;
  idempotencyKey: string | null;
  correlationId: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnqueueInput<TPayload = unknown> {
  type: string;
  payload: TPayload;
  priority?: JobPriority;
  scheduledAt?: Date;
  maxAttempts?: number;
  idempotencyKey?: string;
  correlationId?: string;
  createdById?: string | null;
}

export interface JobContext {
  jobId: string;
  type: string;
  attempts: number;
  maxAttempts: number;
  workerId: string;
  correlationId?: string | null;
  createdById?: string | null;
  /** Extends the lease lock for long-running jobs. Fenced to workerId and current lease. */
  renewLease: (extensionMs?: number) => Promise<boolean>;
}

export type JobHandler<TPayload = any, TResult = any> = (
  payload: TPayload,
  ctx: JobContext
) => Promise<TResult>;

/**
 * Thrown by handlers to indicate that the failure is permanent and should NOT be retried
 * (e.g. invalid payload, permanent 403, missing required entity, validation error).
 */
export class NonRetryableError extends Error {
  readonly isRetryable = false;
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = "NonRetryableError";
  }
}

/**
 * Thrown by handlers to explicitly indicate that the error is transient and can be retried
 * (e.g. temporary database disconnect, rate limit, external network timeout).
 */
export class RetryableError extends Error {
  readonly isRetryable = true;
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = "RetryableError";
  }
}

/**
 * Classifies an error into retryable or non-retryable.
 */
export function isErrorRetryable(error: unknown): boolean {
  if (error instanceof NonRetryableError) return false;
  if (error instanceof RetryableError) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Deterministic permanent business/validation/authorization errors
    if (
      msg.includes("forbidden") ||
      msg.includes("unauthorized") ||
      msg.includes("not found") ||
      msg.includes("validation") ||
      msg.includes("invalid payload")
    ) {
      return false;
    }
    // Transient network/database/timeout indicators
    if (
      msg.includes("timeout") ||
      msg.includes("econnrefused") ||
      msg.includes("deadlock") ||
      msg.includes("concurrency") ||
      msg.includes("rate limit") ||
      msg.includes("temporarily unavailable")
    ) {
      return true;
    }
  }
  // Default to non-retryable to avoid infinite error loops on unknown exceptions
  return false;
}
