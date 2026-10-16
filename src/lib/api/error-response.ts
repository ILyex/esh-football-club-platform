import "server-only";
import { randomUUID } from "node:crypto";

// src/lib/api/error-response.ts
/**
 * Convert internal errors into a stable JSON payload for the client.
 * Known domain errors are mapped to a short `code` and a friendly `message`.
 * The UI can translate `code` via i18n while falling back to the raw message.
 */
import { FinancialDocumentError } from "@/lib/documents/entity-data-resolvers";
import { StorageConfigurationError } from "@/lib/storage";

export function clientErrorResponse(err: unknown) {
  // Storage configuration error
  if (err instanceof StorageConfigurationError) {
    return new Response(
      JSON.stringify({
        code: "STORAGE_NOT_CONFIGURED",
        message: err.message,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // Known custom error – expense not posted or other financial document issues
  if (err instanceof FinancialDocumentError) {
    return new Response(
      JSON.stringify({
        code: "EXPENSE_NOT_POSTED",
        message: err.message,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Future custom error mappings can be added here.

  // Unexpected server errors can contain database details, storage keys, or
  // provider responses. Keep the response shape stable without exposing those
  // internals to callers; known, user-actionable errors are mapped above.
  const requestId = randomUUID();
  console.error("[GeneratedDocumentDownload] Unexpected server error", {
    requestId,
    error: err instanceof Error ? { name: err.name, message: err.message } : "unknown error"
  });
  const genericMessage = "An unexpected error occurred.";
  return new Response(
    JSON.stringify({
      code: "UNKNOWN_ERROR",
      message: genericMessage,
      requestId,
    }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
