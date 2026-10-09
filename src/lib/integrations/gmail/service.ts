import "server-only";
import { db } from "@/lib/db";
import { getGmailClient, GmailAuthRevokedError, GmailNotFoundError } from "./client";
import { encryptToken, decryptToken } from "./crypto";
import { getGoogleOAuthConfig, GMAIL_SCOPES } from "./config";
import {
  sendEmailSchema,
  replyEmailSchema,
  attachmentDownloadSchema,
  markReadSchema,
  gmailResourceId
} from "./schemas";
import type {
  GmailConnectionDTO,
  GmailMessageSummary,
  GmailMessageDetail,
  GmailThreadDetail,
  SendEmailInput,
  GmailSyncResult
} from "./types";
import { writeAuditLog } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notifications/service";
import { hasPermission, ForbiddenError, type SessionUser } from "@/lib/permissions";
import { sanitizeEmailHtml } from "./sanitizer";

// ============================================================================
// PHASE 11 — ESH GMAIL SERVICE: DOMAIN BUSINESS LOGIC & RBAC ENFORCEMENT
// ============================================================================

/**
 * Returns safe DTO of the official club Gmail connection, without secrets.
 */
export async function getGmailConnectionStatus(): Promise<{
  isGoogleConfigured: boolean;
  connection: GmailConnectionDTO | null;
}> {
  const config = getGoogleOAuthConfig();

  // Prioritize active CONNECTED connection; fall back to most recently updated record
  const record =
    (await (db as any).gmailConnection.findFirst({
      where: { status: "CONNECTED" },
      orderBy: { updatedAt: "desc" }
    })) ||
    (await (db as any).gmailConnection.findFirst({
      orderBy: { updatedAt: "desc" }
    }));

  if (!record) {
    return {
      isGoogleConfigured: config.isConfigured,
      connection: null
    };
  }

  return {
    isGoogleConfigured: config.isConfigured,
    connection: {
      id: record.id,
      emailAddress: record.emailAddress,
      status: record.status,
      scope: record.scope,
      lastSyncAt: record.lastSyncAt,
      lastError: record.lastError,
      createdAt: record.createdAt
    }
  };
}

/**
 * Retrieves the active official Gmail connection and exchanges its encrypted
 * refresh token for a fresh short-lived Google access token.
 */
async function getAuthorizedAccessToken(): Promise<{
  connection: any;
  accessToken: string;
}> {
  const connection = await (db as any).gmailConnection.findFirst({
    where: { status: "CONNECTED" },
    orderBy: { updatedAt: "desc" }
  });

  if (!connection) {
    throw new Error("No active official Gmail connection found. Please connect the club Google account.");
  }

  let plainRefreshToken: string;
  try {
    plainRefreshToken = decryptToken(connection.encryptedRefreshToken);
  } catch {
    const useMockClient = process.env.NODE_ENV === "test" ||
      (process.env.NODE_ENV !== "production" && process.env.GMAIL_USE_MOCK?.trim().toLowerCase() === "true");
    if (useMockClient) {
      plainRefreshToken = "mock-refresh-token-67890";
    } else {
      await (db as any).gmailConnection.update({
        where: { id: connection.id },
        data: {
          status: "ERROR",
          lastError: "Failed to decrypt refresh token. Encryption key may have changed."
        }
      });
      throw new Error("Corrupted or unreadable Gmail connection credentials.");
    }
  }

  const client = getGmailClient();
  try {
    const accessToken = await client.refreshAccessToken(plainRefreshToken);
    return { connection, accessToken };
  } catch (err: any) {
    if (err instanceof GmailAuthRevokedError) {
      await (db as any).gmailConnection.update({
        where: { id: connection.id },
        data: {
          status: "REVOKED",
          lastError: "Google OAuth refresh token was revoked or expired."
        }
      });
      await writeAuditLog({
        userId: null,
        action: "GMAIL_AUTH_REVOKED",
        entityType: "GmailConnection",
        entityId: connection.id,
        changes: { error: err.message }
      });
    }
    throw err;
  }
}

/**
 * Connects the official ESH Gmail mailbox using an authorization code from Google OAuth.
 * Strict RBAC: Requires 'mail.manage' (or super_admin).
 *
 * Account Switching Safety:
 * When connecting an account, any previously active connection for a different email
 * address is automatically set to DISCONNECTED, guaranteeing zero orphaned active connections.
 */
export async function connectOfficialGmail(
  code: string,
  redirectUri: string,
  user: SessionUser
): Promise<GmailConnectionDTO> {
  if (!hasPermission(user, "mail.manage")) {
    throw new ForbiddenError("mail.manage");
  }

  const client = getGmailClient();
  const tokenData = await client.exchangeCodeForTokens(code, redirectUri);
  const grantedScopes = new Set(tokenData.scope.split(/\s+/).filter(Boolean));
  const missingScopes = GMAIL_SCOPES.filter((scope) => !grantedScopes.has(scope));
  if (missingScopes.length > 0) {
    throw new Error("Google did not grant the Gmail permissions required by the mailbox.");
  }
  const encryptedRefreshToken = encryptToken(tokenData.refreshToken);

  // Deactivate any previously active connection for other mailboxes (ensures single active mailbox)
  await (db as any).gmailConnection.updateMany({
    where: {
      status: "CONNECTED",
      emailAddress: { not: tokenData.emailAddress }
    },
    data: { status: "DISCONNECTED" }
  });

  const connection = await (db as any).gmailConnection.upsert({
    where: { emailAddress: tokenData.emailAddress },
    create: {
      emailAddress: tokenData.emailAddress,
      encryptedRefreshToken,
      scope: tokenData.scope,
      status: "CONNECTED",
      lastHistoryId: null,
      connectedById: user.id
    },
    update: {
      encryptedRefreshToken,
      scope: tokenData.scope,
      status: "CONNECTED",
      lastError: null,
      lastHistoryId: null, // Reset history pointer to force clean fresh sync
      connectedById: user.id
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "GMAIL_CONNECTED",
    entityType: "GmailConnection",
    entityId: connection.id,
    changes: {
      emailAddress: connection.emailAddress,
      scope: connection.scope
    }
  });

  return {
    id: connection.id,
    emailAddress: connection.emailAddress,
    status: connection.status,
    scope: connection.scope,
    lastSyncAt: connection.lastSyncAt,
    lastError: connection.lastError,
    createdAt: connection.createdAt
  };
}

/**
 * Disconnects all active ESH Gmail connections.
 * Strict RBAC: Requires 'mail.manage'.
 */
export async function disconnectOfficialGmail(user: SessionUser): Promise<void> {
  if (!hasPermission(user, "mail.manage")) {
    throw new ForbiddenError("mail.manage");
  }

  const activeConnections = await (db as any).gmailConnection.findMany({
    where: { status: "CONNECTED" }
  });

  for (const active of activeConnections) {
    await (db as any).gmailConnection.update({
      where: { id: active.id },
      data: { status: "DISCONNECTED" }
    });

    await writeAuditLog({
      userId: user.id,
      action: "GMAIL_DISCONNECTED",
      entityType: "GmailConnection",
      entityId: active.id,
      changes: { emailAddress: active.emailAddress }
    });
  }
}

/**
 * Lists messages from the official inbox with pagination and search query support.
 * Strict RBAC: Requires 'mail.view'.
 */
export async function listMailboxMessages(
  options: {
    maxResults?: number;
    pageToken?: string;
    query?: string;
    label?: string;
  },
  user: SessionUser
): Promise<{ messages: GmailMessageSummary[]; nextPageToken?: string; totalEstimate: number }> {
  if (!hasPermission(user, "mail.view")) {
    throw new ForbiddenError("mail.view");
  }

  const { accessToken } = await getAuthorizedAccessToken();
  const client = getGmailClient();

  const labelIds = options.label ? [options.label] : ["INBOX"];
  const result = await client.listMessages(accessToken, {
    maxResults: options.maxResults || 20,
    pageToken: options.pageToken,
    q: options.query,
    labelIds
  });

  return {
    messages: result.messages,
    nextPageToken: result.nextPageToken,
    totalEstimate: result.resultSizeEstimate
  };
}

/**
 * Retrieves thread details with all messages and sanitized bodies.
 * Strict RBAC: Requires 'mail.view'.
 */
export async function getMailThread(threadId: string, user: SessionUser): Promise<GmailThreadDetail> {
  if (!hasPermission(user, "mail.view")) {
    throw new ForbiddenError("mail.view");
  }

  gmailResourceId.parse(threadId);

  const { accessToken } = await getAuthorizedAccessToken();
  const client = getGmailClient();
  return await client.getThread(accessToken, threadId);
}

/**
 * Retrieves individual message details.
 * Strict RBAC: Requires 'mail.view'.
 */
export async function getMailMessage(messageId: string, user: SessionUser): Promise<GmailMessageDetail> {
  if (!hasPermission(user, "mail.view")) {
    throw new ForbiddenError("mail.view");
  }

  gmailResourceId.parse(messageId);

  const { accessToken } = await getAuthorizedAccessToken();
  const client = getGmailClient();
  return await client.getMessage(accessToken, messageId);
}

/**
 * Marks a thread as read or unread.
 * Strict RBAC: Requires 'mail.view'.
 */
export async function setThreadReadState(
  threadId: string,
  isRead: boolean,
  user: SessionUser
): Promise<void> {
  if (!hasPermission(user, "mail.view")) {
    throw new ForbiddenError("mail.view");
  }

  markReadSchema.parse({ threadId, read: isRead });

  const { accessToken } = await getAuthorizedAccessToken();
  const client = getGmailClient();

  const addLabels = isRead ? [] : ["UNREAD"];
  const removeLabels = isRead ? ["UNREAD"] : [];

  // Read state belongs to the shared mailbox. When one authorized user reads
  // a thread, close the corresponding incoming-mail notifications for everyone
  // so another user is not alerted about an already-read email.
  const thread = isRead ? await client.getThread(accessToken, threadId) : null;
  await client.modifyThreadLabels(accessToken, threadId, addLabels, removeLabels);

  if (thread?.messages.length) {
    await db.notification.updateMany({
      where: {
        isRead: false,
        OR: thread.messages.map((message) => ({
          dedupKey: { startsWith: `NEW_CORRESPONDENCE:gmail-msg-${message.id}:` }
        }))
      },
      data: { isRead: true }
    });
  }

  await writeAuditLog({
    userId: user.id,
    action: "GMAIL_READ_STATE_CHANGED",
    entityType: "GmailThread",
    entityId: threadId,
    changes: { isRead }
  });
}

/**
 * Sends a new official email through the club Gmail account.
 * Strict RBAC: Requires 'mail.send'.
 */
export async function sendOfficialEmail(
  rawInput: SendEmailInput,
  user: SessionUser
): Promise<{ messageId: string; threadId: string }> {
  if (!hasPermission(user, "mail.send")) {
    throw new ForbiddenError("mail.send");
  }

  const validated = sendEmailSchema.parse(rawInput);
  const { accessToken } = await getAuthorizedAccessToken();
  const client = getGmailClient();

  // Sanitize author-controlled HTML at the service boundary as well as when
  // rendering received messages. This prevents unsafe markup from being sent
  // to providers or retained by mock/test adapters.
  const safeEmail = { ...validated, bodyHtml: sanitizeEmailHtml(validated.bodyHtml) };
  const result = await client.sendEmail(accessToken, safeEmail);

  await writeAuditLog({
    userId: user.id,
    action: "GMAIL_MESSAGE_SENT",
    entityType: "GmailMessage",
    entityId: result.messageId,
    changes: {
      to: validated.to,
      subject: validated.subject,
      threadId: result.threadId
    }
  });

  return result;
}

/**
 * Replies to an existing thread.
 * Strict RBAC: Requires 'mail.send'.
 */
export async function replyToOfficialEmail(
  rawInput: any,
  user: SessionUser
): Promise<{ messageId: string; threadId: string }> {
  if (!hasPermission(user, "mail.send")) {
    throw new ForbiddenError("mail.send");
  }

  const validated = replyEmailSchema.parse(rawInput);
  const { accessToken } = await getAuthorizedAccessToken();
  const client = getGmailClient();

  const safeReply = { ...validated, bodyHtml: sanitizeEmailHtml(validated.bodyHtml) };
  const result = await client.sendEmail(accessToken, safeReply);

  await writeAuditLog({
    userId: user.id,
    action: "GMAIL_MESSAGE_REPLIED",
    entityType: "GmailMessage",
    entityId: result.messageId,
    changes: {
      threadId: validated.threadId,
      to: validated.to,
      subject: validated.subject
    }
  });

  return result;
}

/**
 * Moves an official email message to the Gmail Trash folder.
 * Strict RBAC: Requires 'mail.view' or 'mail.manage'.
 */
export async function trashMailMessage(
  messageId: string,
  user: SessionUser
): Promise<{ success: boolean }> {
  if (!hasPermission(user, "mail.manage")) {
    throw new ForbiddenError("mail.manage");
  }

  gmailResourceId.parse(messageId);

  const { accessToken } = await getAuthorizedAccessToken();
  const client = getGmailClient();
  await client.trashMessage(accessToken, messageId);

  await writeAuditLog({
    userId: user.id,
    action: "GMAIL_MESSAGE_TRASHED",
    entityType: "GmailMessage",
    entityId: messageId,
    changes: { trashedAt: new Date().toISOString() }
  });

  return { success: true };
}

/**
 * Moves an entire thread to the Gmail Trash folder.
 * Strict RBAC: Requires 'mail.view' or 'mail.manage'.
 */
export async function trashMailThread(
  threadId: string,
  user: SessionUser
): Promise<{ success: boolean }> {
  if (!hasPermission(user, "mail.manage")) {
    throw new ForbiddenError("mail.manage");
  }

  gmailResourceId.parse(threadId);

  const { accessToken } = await getAuthorizedAccessToken();
  const client = getGmailClient();
  await client.trashThread(accessToken, threadId);

  await writeAuditLog({
    userId: user.id,
    action: "GMAIL_THREAD_TRASHED",
    entityType: "GmailThread",
    entityId: threadId,
    changes: { trashedAt: new Date().toISOString() }
  });

  return { success: true };
}

/**
 * Securely streams an email attachment after verifying permissions and path safety.
 * Strict RBAC: Requires 'mail.view'.
 */
export async function getMailAttachment(
  messageId: string,
  attachmentId: string,
  filename: string,
  user: SessionUser
): Promise<{ data: Buffer; size: number }> {
  if (!hasPermission(user, "mail.view")) {
    throw new ForbiddenError("mail.view");
  }

  attachmentDownloadSchema.parse({ messageId, attachmentId, filename });

  const { accessToken } = await getAuthorizedAccessToken();
  const client = getGmailClient();

  const result = await client.getAttachment(accessToken, messageId, attachmentId);

  await writeAuditLog({
    userId: user.id,
    action: "GMAIL_ATTACHMENT_ACCESSED",
    entityType: "GmailAttachment",
    entityId: attachmentId,
    changes: { messageId, filename, size: result.size }
  });

  return result;
}

/**
 * Performs incremental background mailbox sync, notifies on unread messages,
 * and updates sync metadata.
 */
export async function syncGmailInbox(initiatorUserId?: string | null): Promise<GmailSyncResult> {
  const { connection, accessToken } = await getAuthorizedAccessToken();
  const client = getGmailClient();

  let newMessagesCount = 0;
  let recentMessagesCount = 0;
  let newHistoryId: string | null = connection.lastHistoryId;

  const notifyIncomingMessages = async (messageIds: string[]) => {
    const uniqueIds = Array.from(new Set(messageIds));
    newMessagesCount += uniqueIds.length;
    for (let i = 0; i < uniqueIds.length; i += 5) {
      await Promise.all(uniqueIds.slice(i, i + 5).map(async (msgId) => {
        let msg;
        try {
          msg = await client.getMessage(accessToken, msgId);
        } catch (error) {
          // A message may be deleted after appearing in history. Other errors must
          // fail the job so the checkpoint is not advanced before notification.
          if (error instanceof GmailNotFoundError) return;
          throw error;
        }
        if (!msg.isUnread || (!msg.labels.includes("INBOX") && !msg.labels.includes("SPAM"))) return;
        if (Date.now() - msg.receivedAt.getTime() <= 30 * 60 * 1000) recentMessagesCount += 1;
        const isSpam = msg.labels.includes("SPAM");
        await dispatchNotification(db, {
          type: "NEW_CORRESPONDENCE",
          title: isSpam ? `[غير مرغوب / SPAM] بريد جديد: ${msg.subject}` : `بريد وارد جديد: ${msg.subject}`,
          message: `${msg.sender.name || msg.sender.email}: ${msg.snippet.slice(0, 100)}`,
          link: `/dashboard/mail`,
          requiredPermission: "mail.view",
          dedupKey: `gmail-msg-${msg.id}`
        });
      }));
    }
  };

  if (connection.lastHistoryId) {
    try {
      const messageIds: string[] = [];
      let pageToken: string | undefined;
      do {
        const history = await client.listHistory(accessToken, connection.lastHistoryId, pageToken);
        newHistoryId = history.historyId;
        messageIds.push(...history.messagesAdded);
        pageToken = history.nextPageToken;
      }
      while (pageToken);
      await notifyIncomingMessages(messageIds);
    } catch (error) {
      if (!(error instanceof GmailNotFoundError)) throw error;

      // Gmail history IDs expire after inactivity. Recover currently unread mail
      // before establishing a fresh checkpoint instead of silently losing it.
      const profile = await client.getProfile(accessToken);
      newHistoryId = profile.historyId;
      const unreadIds: string[] = [];
      let pageToken: string | undefined;
      do {
        const unreadPage = await client.listMessages(accessToken, {
          maxResults: 50,
          pageToken,
          q: "is:unread {in:inbox in:spam}",
          labelIds: []
        });
        unreadIds.push(...unreadPage.messages.map((message) => message.id));
        pageToken = unreadPage.nextPageToken;
      } while (pageToken);
      await notifyIncomingMessages(unreadIds);
    }
  } else {
    // Initial sync
    const profile = await client.getProfile(accessToken);
    newHistoryId = profile.historyId;
  }

  const now = new Date();
  await (db as any).gmailConnection.update({
    where: { id: connection.id },
    data: {
      lastSyncAt: now,
      lastHistoryId: newHistoryId,
      lastError: null
    }
  });

  await writeAuditLog({
    userId: initiatorUserId || null,
    action: "GMAIL_SYNC_COMPLETED",
    entityType: "GmailConnection",
    entityId: connection.id,
    changes: {
      newMessagesCount,
      historyId: newHistoryId,
      syncedAt: now.toISOString()
    }
  });

  return {
    connectionId: connection.id,
    emailAddress: connection.emailAddress,
    newMessagesCount,
    recentMessagesCount,
    historyId: newHistoryId,
    syncedAt: now
  };
}
