import { z } from "zod";

// ============================================================================
// PHASE 11 — GMAIL INTEGRATION: INPUT VALIDATION & HEADER INJECTION DEFENSES
// ============================================================================

/**
 * Checks that an email header value does not contain newline or carriage return
 * characters, preventing CRLF email header injection attacks.
 */
function isCleanHeader(val: string): boolean {
  return !/[\r\n\0]/.test(val) && !/%0[ad]/i.test(val);
}

/**
 * Validates email addresses and ensures no header injection characters.
 */
const safeEmailAddressSchema = z
  .string()
  .trim()
  .email("Invalid email format")
  .refine(isCleanHeader, "Email address contains invalid header characters");

const gmailResourceIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, "Invalid Gmail resource ID");

const safeAttachmentSchema = z.object({
  filename: z.string().min(1).max(255).refine((fn) => !/[\r\n\0"]/.test(fn) && !fn.includes("..") && !fn.includes("/") && !fn.includes("\\"), {
    message: "Path traversal in filename is prohibited"
  }),
  mimeType: z.string().max(100).regex(/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/).default("application/octet-stream"),
  contentBase64: z.string().max(24 * 1024 * 1024).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
});

export const sendEmailSchema = z
  .object({
    to: z
      .array(safeEmailAddressSchema)
      .min(1, "At least one recipient is required")
      .max(50, "Maximum 50 recipients allowed"),
    cc: z
      .array(safeEmailAddressSchema)
      .max(50, "Maximum 50 CC recipients allowed")
      .optional()
      .default([]),
    bcc: z
      .array(safeEmailAddressSchema)
      .max(50, "Maximum 50 BCC recipients allowed")
      .optional()
      .default([]),
    subject: z
      .string()
      .trim()
      .min(1, "Subject cannot be empty")
      .max(255, "Subject cannot exceed 255 characters")
      .refine(isCleanHeader, "Subject contains invalid newline or control characters"),
    bodyText: z.string().max(200000, "Body text too large").optional(),
    bodyHtml: z.string().max(500000, "Body HTML too large").optional(),
    attachments: z
      .array(safeAttachmentSchema)
      .max(10, "Maximum 10 attachments allowed")
      .optional()
      .default([])
  })
  .refine(
    (data) => Boolean((data.bodyText && data.bodyText.trim().length > 0) || (data.bodyHtml && data.bodyHtml.trim().length > 0)),
    {
      message: "Email body (text or HTML) must not be empty",
      path: ["bodyText"]
    }
  );

export const replyEmailSchema = z.object({
  threadId: gmailResourceIdSchema,
  inReplyTo: z.string().min(1, "Original message ID is required").refine(isCleanHeader, "Invalid message ID"),
  references: z.string().max(1000).refine(isCleanHeader, "Invalid references").optional(),
  to: z.array(safeEmailAddressSchema).min(1, "At least one recipient is required"),
  cc: z.array(safeEmailAddressSchema).optional().default([]),
  subject: z.string().trim().max(255).refine(isCleanHeader, "Subject contains invalid characters"),
  bodyText: z.string().max(200000).optional(),
  bodyHtml: z.string().max(500000).optional(),
  attachments: z
    .array(safeAttachmentSchema)
    .max(10, "Maximum 10 attachments allowed")
    .optional()
    .default([])
});

export const attachmentDownloadSchema = z.object({
  messageId: gmailResourceIdSchema,
  attachmentId: z.string().min(1).max(512).regex(/^[A-Za-z0-9_=-]+$/, "Invalid Gmail attachment ID"),
  filename: z
    .string()
    .min(1)
    .max(255)
    .refine((fn) => !fn.includes("..") && !fn.includes("/") && !fn.includes("\\"), {
      message: "Path traversal in filename is prohibited"
    })
});

export const markReadSchema = z.object({
  threadId: gmailResourceIdSchema,
  read: z.boolean()
});

export const gmailResourceId = gmailResourceIdSchema;
