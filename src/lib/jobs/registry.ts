import { z } from "zod";
import type { JobHandler, JobPriority } from "./types";
import { NonRetryableError } from "./types";

// ============================================================================
// P5 — JOB HANDLER REGISTRY
// ----------------------------------------------------------------------------
// Type-safe registry for background jobs. Every executable job type MUST be
// registered here with a runtime Zod schema for payload validation and a
// strongly-typed handler. Dynamic imports, evals, and executing arbitrary
// paths from database columns are strictly prohibited.
// ============================================================================

export interface JobDefinition<TPayload = any, TResult = any> {
  type: string;
  schema: z.ZodType<TPayload>;
  handler: JobHandler<TPayload, TResult>;
  defaultPriority?: JobPriority;
  defaultMaxAttempts?: number;
}

const REGISTRY = new Map<string, JobDefinition<any, any>>();

export function registerJobHandler<TPayload, TResult>(
  definition: JobDefinition<TPayload, TResult>
): void {
  if (REGISTRY.has(definition.type)) {
    throw new Error(`Job handler for type "${definition.type}" is already registered.`);
  }
  REGISTRY.set(definition.type, definition);
}

export function getJobDefinition(type: string): JobDefinition | undefined {
  return REGISTRY.get(type);
}

export function hasJobHandler(type: string): boolean {
  return REGISTRY.has(type);
}

export function getRegisteredJobTypes(): string[] {
  return Array.from(REGISTRY.keys());
}

/**
 * Validates payload against the registered schema for this job type.
 * Throws NonRetryableError if validation fails so the worker moves the job to FAILED.
 */
export function validateJobPayload<TPayload>(type: string, payload: unknown): TPayload {
  const def = getJobDefinition(type);
  if (!def) {
    throw new NonRetryableError(`Unregistered job type: "${type}"`);
  }
  const result = def.schema.safeParse(payload);
  if (!result.success) {
    throw new NonRetryableError(`Invalid payload for job type "${type}": ${result.error.message}`, result.error.format());
  }
  return result.data as TPayload;
}
