import "server-only";

// ============================================================================
// PHASE 11 — GMAIL INTEGRATION: DOMAIN CONTRACTS & TYPES
// ============================================================================

export type GmailConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR" | "REVOKED";

export interface GmailConnectionDTO {
  id: string;
  emailAddress: string;
  status: GmailConnectionStatus;
  scope: string;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

export interface GmailAttachmentMeta {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  historyId?: string;
  internalDate: string; // epoch ms string
  sender: {
    name?: string;
    email: string;
  };
  recipient: {
    name?: string;
    email: string;
  };
  subject: string;
  labels: string[];
  isUnread: boolean;
  hasAttachments: boolean;
  receivedAt: Date;
  /** RFC 8058/RFC 2369 unsubscribe endpoint advertised by the sender. */
  unsubscribe?: { url: string; oneClick: boolean };
}

export interface GmailMessageDetail extends GmailMessageSummary {
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo?: string;
  bodyHtml?: string;
  bodyText?: string;
  attachments: GmailAttachmentMeta[];
}

export interface GmailThreadDetail {
  id: string;
  historyId?: string;
  messages: GmailMessageDetail[];
  subject: string;
  participants: Array<{ name?: string; email: string }>;
  lastMessageDate: Date;
  isUnread: boolean;
  messageCount: number;
}

export interface SendEmailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: Array<{ filename: string; mimeType: string; contentBase64: string }>;
}

export interface GmailSyncResult {
  connectionId: string;
  emailAddress: string;
  newMessagesCount: number;
  recentMessagesCount: number;
  historyId: string | null;
  syncedAt: Date;
  errors?: string[];
}
