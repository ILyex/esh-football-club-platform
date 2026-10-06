import "server-only";
import type {
  GmailMessageSummary,
  GmailMessageDetail,
  GmailThreadDetail,
  GmailAttachmentMeta,
  SendEmailInput
} from "./types";
import { getGoogleOAuthConfig } from "./config";
import { sanitizeEmailHtml } from "./sanitizer";

// ============================================================================
// PHASE 11 — GMAIL API CLIENT ADAPTER & ERROR BOUNDARIES
// ============================================================================

export class GmailAuthRevokedError extends Error {
  override readonly name = "GmailAuthRevokedError";
  constructor(message = "Gmail OAuth authorization has been revoked or expired") {
    super(message);
  }
}

export class GmailRateLimitError extends Error {
  override readonly name = "GmailRateLimitError";
  constructor(message = "Gmail API rate limit exceeded") {
    super(message);
  }
}

export class GmailForbiddenError extends Error {
  override readonly name = "GmailForbiddenError";
  constructor(message = "Gmail API access forbidden: check account scopes") {
    super(message);
  }
}

export class GmailNotFoundError extends Error {
  override readonly name = "GmailNotFoundError";
  constructor(message = "Requested Gmail resource not found") {
    super(message);
  }
}

export class GmailApiError extends Error {
  override readonly name = "GmailApiError";
  constructor(message: string, readonly status: number, readonly details?: unknown) {
    super(message);
  }
}

export interface IGmailClient {
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string;
    emailAddress: string;
    scope: string;
  }>;
  refreshAccessToken(refreshToken: string): Promise<string>;
  getProfile(accessToken: string): Promise<{ emailAddress: string; historyId: string }>;
  listMessages(
    accessToken: string,
    options?: { maxResults?: number; pageToken?: string; q?: string; labelIds?: string[] }
  ): Promise<{ messages: GmailMessageSummary[]; nextPageToken?: string; resultSizeEstimate: number }>;
  getMessage(accessToken: string, messageId: string): Promise<GmailMessageDetail>;
  getThread(accessToken: string, threadId: string): Promise<GmailThreadDetail>;
  modifyThreadLabels(
    accessToken: string,
    threadId: string,
    addLabels?: string[],
    removeLabels?: string[]
  ): Promise<void>;
  sendEmail(accessToken: string, email: SendEmailInput): Promise<{ messageId: string; threadId: string }>;
  trashMessage(accessToken: string, messageId: string): Promise<void>;
  trashThread(accessToken: string, threadId: string): Promise<void>;
  getAttachment(accessToken: string, messageId: string, attachmentId: string): Promise<{ data: Buffer; size: number }>;
  listHistory(accessToken: string, startHistoryId: string, pageToken?: string): Promise<{ historyId: string; messagesAdded: string[]; nextPageToken?: string }>;
}

// ----------------------------------------------------------------------------
// MIME PARSER HELPERS
// ----------------------------------------------------------------------------

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function parseMessagePart(part: any): { bodyText: string; bodyHtml: string; attachments: GmailAttachmentMeta[] } {
  let bodyText = "";
  let bodyHtml = "";
  const attachments: GmailAttachmentMeta[] = [];

  if (!part) return { bodyText, bodyHtml, attachments };

  const mimeType = part.mimeType || "";
  const body = part.body || {};

  if (part.filename && part.filename.length > 0 && body.attachmentId) {
    attachments.push({
      id: body.attachmentId,
      messageId: "", // filled by caller
      filename: part.filename,
      mimeType: mimeType || "application/octet-stream",
      size: body.size || 0
    });
  }

  if (mimeType === "text/plain" && body.data) {
    bodyText = decodeBase64Url(body.data);
  } else if (mimeType === "text/html" && body.data) {
    bodyHtml = decodeBase64Url(body.data);
  }

  if (Array.isArray(part.parts)) {
    for (const subPart of part.parts) {
      const parsed = parseMessagePart(subPart);
      if (parsed.bodyText && !bodyText) bodyText = parsed.bodyText;
      if (parsed.bodyHtml && !bodyHtml) bodyHtml = parsed.bodyHtml;
      attachments.push(...parsed.attachments);
    }
  }

  return { bodyText, bodyHtml, attachments };
}

function extractHeader(headers: Array<{ name: string; value: string }> | undefined, name: string): string {
  if (!headers) return "";
  const found = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value?.trim() || "";
}

/**
 * Read the sender's standards-based unsubscribe header. We deliberately only
 * expose https/mailto endpoints; arbitrary schemes must never become clickable
 * UI actions. The first https endpoint is preferred because RFC 8058 supports
 * a one-click POST there.
 */
function extractUnsubscribe(headers: Array<{ name: string; value: string }> | undefined):
  { url: string; oneClick: boolean } | undefined {
  const raw = extractHeader(headers, "List-Unsubscribe");
  if (!raw) return undefined;
  const urls = Array.from(raw.matchAll(/<([^>]+)>/g))
    .map((match) => match[1]?.trim())
    .filter((url): url is string => Boolean(url));
  const candidate = urls.find((url) => /^https:\/\//i.test(url)) || urls.find((url) => /^mailto:/i.test(url));
  if (!candidate) return undefined;
  const oneClick = /^https:\/\//i.test(candidate) && /list-unsubscribe\s*=\s*one-click/i.test(
    extractHeader(headers, "List-Unsubscribe-Post")
  );
  return { url: candidate, oneClick };
}

function parseEmailAddress(raw: string): { name?: string; email: string } {
  if (!raw) return { email: "" };
  const match = raw.match(/^(.*?)\s*<(.+?)>$/);
  if (match && match[2]) {
    const name = match[1]?.trim().replace(/^["']|["']$/g, "");
    return { name: name || undefined, email: match[2].trim() };
  }
  return { email: raw.trim().replace(/^["']|["']$/g, "") };
}

// ----------------------------------------------------------------------------
// PRODUCTION ADAPTER (Google REST API with Fetch)
// ----------------------------------------------------------------------------

export class GoogleGmailApiClient implements IGmailClient {
  private async request<T>(url: string, options: RequestInit = {}, retries = 2): Promise<T> {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000),
        headers: {
          Accept: "application/json",
          ...options.headers
        }
      });

      if (res.status === 401) {
        throw new GmailAuthRevokedError();
      }
      if (res.status === 403) {
        const errorBody = await res.json().catch(() => ({}));
        const reason = errorBody?.error?.errors?.[0]?.reason;
        if (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded") {
          throw new GmailRateLimitError();
        }
        throw new GmailForbiddenError(errorBody?.error?.message || "Forbidden");
      }
      if (res.status === 429) {
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));
          return this.request<T>(url, options, retries - 1);
        }
        throw new GmailRateLimitError();
      }
      if (res.status === 404) {
        throw new GmailNotFoundError();
      }
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new GmailApiError(
          errorBody?.error?.message || `Gmail API HTTP ${res.status}`,
          res.status,
          errorBody
        );
      }

      return (await res.json()) as T;
    } catch (err: any) {
      if (
        err instanceof GmailAuthRevokedError ||
        err instanceof GmailForbiddenError ||
        err instanceof GmailRateLimitError ||
        err instanceof GmailNotFoundError ||
        err instanceof GmailApiError
      ) {
        throw err;
      }
      throw new GmailApiError(err.message || "Network error contacting Gmail API", 500);
    }
  }

  async exchangeCodeForTokens(code: string, redirectUri: string) {
    const config = getGoogleOAuthConfig();
    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new GmailApiError(err.error_description || "Failed to exchange authorization code", res.status);
    }

    const data = await res.json();
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;

    if (!refreshToken) {
      throw new GmailApiError(
        "Google did not return a refresh token. Ensure 'prompt=consent' and 'access_type=offline' are used.",
        400
      );
    }

    // Get authenticated profile
    const profile = await this.getProfile(accessToken);

    return {
      accessToken,
      refreshToken,
      emailAddress: profile.emailAddress,
      scope: data.scope || ""
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const config = getGoogleOAuthConfig();
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15000)
    });

    if (res.status === 400 || res.status === 401) {
      throw new GmailAuthRevokedError();
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new GmailApiError(err.error_description || "Token refresh failed", res.status);
    }

    const data = await res.json();
    return data.access_token;
  }

  async getProfile(accessToken: string): Promise<{ emailAddress: string; historyId: string }> {
    const data = await this.request<any>("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return {
      emailAddress: data.emailAddress,
      historyId: data.historyId
    };
  }

  async listMessages(
    accessToken: string,
    options: { maxResults?: number; pageToken?: string; q?: string; labelIds?: string[] } = {}
  ): Promise<{ messages: GmailMessageSummary[]; nextPageToken?: string; resultSizeEstimate: number }> {
    const params = new URLSearchParams();
    params.set("maxResults", Math.min(options.maxResults || 20, 50).toString());
    if (options.pageToken) params.set("pageToken", options.pageToken);
    if (options.q) params.set("q", options.q);
    if (options.labelIds && options.labelIds.length > 0) {
      for (const label of options.labelIds) {
        params.append("labelIds", label);
      }
    }

    const listRes = await this.request<any>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const rawList = listRes.messages || [];
    const messages: GmailMessageSummary[] = [];

    // Concurrently fetch metadata for listed messages (bounded concurrency 5)
    for (let i = 0; i < rawList.length; i += 5) {
      const slice = rawList.slice(i, i + 5);
      const batch = await Promise.all(
        slice.map(async (item: { id: string }) => {
          try {
            const detail = await this.request<any>(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            const headers = detail.payload?.headers || [];
            const fromHeader = extractHeader(headers, "From");
            const toHeader = extractHeader(headers, "To");
            const subjectHeader = extractHeader(headers, "Subject") || "(No Subject)";
            const labels = detail.labelIds || [];

            return {
              id: detail.id,
              threadId: detail.threadId,
              snippet: detail.snippet || "",
              historyId: detail.historyId,
              internalDate: detail.internalDate,
              sender: parseEmailAddress(fromHeader),
              recipient: parseEmailAddress(toHeader),
              subject: subjectHeader,
              labels,
              isUnread: labels.includes("UNREAD"),
              hasAttachments: Boolean(detail.payload?.body?.size > 0 || (detail.payload?.parts && detail.payload.parts.some((p: any) => p.filename))),
              receivedAt: new Date(parseInt(detail.internalDate, 10)),
              unsubscribe: extractUnsubscribe(headers)
            } as GmailMessageSummary;
          } catch {
            return null;
          }
        })
      );
      for (const m of batch) {
        if (m) messages.push(m);
      }
    }

    return {
      messages,
      nextPageToken: listRes.nextPageToken,
      resultSizeEstimate: listRes.resultSizeEstimate || messages.length
    };
  }

  async getMessage(accessToken: string, messageId: string): Promise<GmailMessageDetail> {
    const detail = await this.request<any>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const headers = detail.payload?.headers || [];
    const fromHeader = extractHeader(headers, "From");
    const toHeader = extractHeader(headers, "To");
    const ccHeader = extractHeader(headers, "Cc");
    const bccHeader = extractHeader(headers, "Bcc");
    const subjectHeader = extractHeader(headers, "Subject") || "(No Subject)";
    const replyToHeader = extractHeader(headers, "Reply-To");
    const unsubscribe = extractUnsubscribe(headers);
    const labels = detail.labelIds || [];

    const parsedParts = parseMessagePart(detail.payload);
    for (const att of parsedParts.attachments) {
      att.messageId = detail.id;
    }

    return {
      id: detail.id,
      threadId: detail.threadId,
      snippet: detail.snippet || "",
      historyId: detail.historyId,
      internalDate: detail.internalDate,
      sender: parseEmailAddress(fromHeader),
      recipient: parseEmailAddress(toHeader),
      to: toHeader ? toHeader.split(",").map((s) => s.trim()) : [],
      cc: ccHeader ? ccHeader.split(",").map((s) => s.trim()) : [],
      bcc: bccHeader ? bccHeader.split(",").map((s) => s.trim()) : [],
      replyTo: replyToHeader || undefined,
      subject: subjectHeader,
      labels,
      isUnread: labels.includes("UNREAD"),
      hasAttachments: parsedParts.attachments.length > 0,
      receivedAt: new Date(parseInt(detail.internalDate, 10)),
      unsubscribe,
      bodyText: parsedParts.bodyText,
      bodyHtml: sanitizeEmailHtml(parsedParts.bodyHtml),
      attachments: parsedParts.attachments
    };
  }

  async getThread(accessToken: string, threadId: string): Promise<GmailThreadDetail> {
    const threadData = await this.request<any>(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const rawMessages = threadData.messages || [];
    const messages: GmailMessageDetail[] = [];
    const participantsMap = new Map<string, { name?: string; email: string }>();

    for (const rawMsg of rawMessages) {
      const headers = rawMsg.payload?.headers || [];
      const fromHeader = extractHeader(headers, "From");
      const toHeader = extractHeader(headers, "To");
      const ccHeader = extractHeader(headers, "Cc");
      const bccHeader = extractHeader(headers, "Bcc");
      const subjectHeader = extractHeader(headers, "Subject") || "(No Subject)";
      const replyToHeader = extractHeader(headers, "Reply-To");
      const unsubscribe = extractUnsubscribe(headers);
      const labels = rawMsg.labelIds || [];

      const parsedParts = parseMessagePart(rawMsg.payload);
      for (const att of parsedParts.attachments) {
        att.messageId = rawMsg.id;
      }

      const sender = parseEmailAddress(fromHeader);
      if (sender.email) participantsMap.set(sender.email.toLowerCase(), sender);

      messages.push({
        id: rawMsg.id,
        threadId: rawMsg.threadId,
        snippet: rawMsg.snippet || "",
        historyId: rawMsg.historyId,
        internalDate: rawMsg.internalDate,
        sender,
        recipient: parseEmailAddress(toHeader),
        to: toHeader ? toHeader.split(",").map((s) => s.trim()) : [],
        cc: ccHeader ? ccHeader.split(",").map((s) => s.trim()) : [],
        bcc: bccHeader ? bccHeader.split(",").map((s) => s.trim()) : [],
        replyTo: replyToHeader || undefined,
        subject: subjectHeader,
        labels,
        isUnread: labels.includes("UNREAD"),
        hasAttachments: parsedParts.attachments.length > 0,
        receivedAt: new Date(parseInt(rawMsg.internalDate, 10)),
        unsubscribe,
        bodyText: parsedParts.bodyText,
        bodyHtml: sanitizeEmailHtml(parsedParts.bodyHtml),
        attachments: parsedParts.attachments
      });
    }

    const firstMsg = messages[0];
    const lastMsg = messages[messages.length - 1];

    return {
      id: threadData.id,
      historyId: threadData.historyId,
      messages,
      subject: firstMsg?.subject || "(No Subject)",
      participants: Array.from(participantsMap.values()),
      lastMessageDate: lastMsg?.receivedAt || new Date(),
      isUnread: messages.some((m) => m.isUnread),
      messageCount: messages.length
    };
  }

  async modifyThreadLabels(
    accessToken: string,
    threadId: string,
    addLabels: string[] = [],
    removeLabels: string[] = []
  ): Promise<void> {
    await this.request<any>(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          addLabelIds: addLabels,
          removeLabelIds: removeLabels
        })
      }
    );
  }

  async trashMessage(accessToken: string, messageId: string): Promise<void> {
    await this.request<any>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/trash`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
  }

  async trashThread(accessToken: string, threadId: string): Promise<void> {
    await this.request<any>(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}/trash`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
  }

  async sendEmail(accessToken: string, email: SendEmailInput): Promise<{ messageId: string; threadId: string }> {
    // Construct safe RFC 2822 MIME message
    const hasAttachments = Boolean(email.attachments && email.attachments.length > 0);
    const mixedBoundary = `====mixed_${Date.now()}====`;
    const altBoundary = `====alt_${Date.now()}====`;
    const lines: string[] = [];

    lines.push(`To: ${email.to.join(", ")}`);
    if (email.cc && email.cc.length > 0) lines.push(`Cc: ${email.cc.join(", ")}`);
    if (email.bcc && email.bcc.length > 0) lines.push(`Bcc: ${email.bcc.join(", ")}`);
    if (email.replyTo) lines.push(`Reply-To: ${email.replyTo}`);
    if (email.inReplyTo) lines.push(`In-Reply-To: ${email.inReplyTo}`);
    if (email.references) lines.push(`References: ${email.references}`);
    lines.push(`Subject: =?utf-8?B?${Buffer.from(email.subject, "utf-8").toString("base64")}?=`);
    lines.push("MIME-Version: 1.0");

    if (hasAttachments) {
      lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
      lines.push("");
      lines.push(`--${mixedBoundary}`);
    }

    if (email.bodyHtml) {
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      lines.push("");
      lines.push(`--${altBoundary}`);
      lines.push("Content-Type: text/plain; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(Buffer.from(email.bodyText || "", "utf-8").toString("base64"));
      lines.push("");
      lines.push(`--${altBoundary}`);
      lines.push("Content-Type: text/html; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(Buffer.from(email.bodyHtml, "utf-8").toString("base64"));
      lines.push("");
      lines.push(`--${altBoundary}--`);
    } else {
      lines.push("Content-Type: text/plain; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(Buffer.from(email.bodyText || "", "utf-8").toString("base64"));
    }

    if (hasAttachments && email.attachments) {
      for (const att of email.attachments) {
        lines.push("");
        lines.push(`--${mixedBoundary}`);
        const safeMimeType = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(att.mimeType)
          ? att.mimeType
          : "application/octet-stream";
        const fallbackFilename = att.filename
          .replace(/[\r\n\0"\\;]/g, "_")
          .replace(/[^\x20-\x7E]/g, "_")
          .slice(0, 120) || "attachment";
        const encodedFilename = encodeURIComponent(att.filename).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
        lines.push(`Content-Type: ${safeMimeType}; name="${fallbackFilename}"; name*=UTF-8''${encodedFilename}`);
        lines.push(`Content-Disposition: attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`);
        lines.push("Content-Transfer-Encoding: base64");
        lines.push("");
        lines.push(att.contentBase64);
      }
      lines.push("");
      lines.push(`--${mixedBoundary}--`);
    }

    const rawMime = lines.join("\r\n");
    const rawBase64Url = Buffer.from(rawMime, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const payload: any = { raw: rawBase64Url };
    if (email.threadId) {
      payload.threadId = email.threadId;
    }

    const res = await this.request<any>("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return {
      messageId: res.id,
      threadId: res.threadId
    };
  }

  async getAttachment(
    accessToken: string,
    messageId: string,
    attachmentId: string
  ): Promise<{ data: Buffer; size: number }> {
    const res = await this.request<any>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const base64 = res.data.replace(/-/g, "+").replace(/_/g, "/");
    const data = Buffer.from(base64, "base64");
    return { data, size: res.size || data.length };
  }

  async listHistory(accessToken: string, startHistoryId: string, pageToken?: string): Promise<{ historyId: string; messagesAdded: string[]; nextPageToken?: string }> {
    const params = new URLSearchParams({ startHistoryId });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await this.request<any>(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const messagesAdded: string[] = [];
    if (Array.isArray(res.history)) {
      for (const item of res.history) {
        if (Array.isArray(item.messagesAdded)) {
          for (const msgAdded of item.messagesAdded) {
            if (msgAdded.message?.id) {
              messagesAdded.push(msgAdded.message.id);
            }
          }
        }
      }
    }

    return {
      historyId: res.historyId || startHistoryId,
      messagesAdded,
      nextPageToken: res.nextPageToken
    };
  }
}

// ----------------------------------------------------------------------------
// MOCK ADAPTER FOR TESTS & DEMO ENVIRONMENTS
// ----------------------------------------------------------------------------

export class MockGmailApiClient implements IGmailClient {
  public mockMessages: Map<string, GmailMessageDetail> = new Map();
  public mockThreads: Map<string, GmailThreadDetail> = new Map();
  public mockAttachments: Map<string, Buffer> = new Map();
  public sentEmails: SendEmailInput[] = [];
  public shouldFailAuth = false;
  public shouldFailRateLimit = false;
  public mockEmailAddress = "secretariat@esh-sydihosni.dz";
  public mockRefreshToken = "mock-refresh-token-67890";

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    const threadId = "thread-esh-001";
    const msgId = "msg-esh-001";

    const msg: GmailMessageDetail = {
      id: msgId,
      threadId,
      snippet: "Convocation pour la réunion de la ligue régionale de football...",
      internalDate: Date.now().toString(),
      sender: { name: "Ligue Régionale de Saïda", email: "secretariat@ligue-saida.dz" },
      recipient: { name: "ESH Secrétariat", email: "secretariat@esh-sydihosni.dz" },
      to: ["secretariat@esh-sydihosni.dz"],
      cc: [],
      bcc: [],
      subject: "Convocation — Tirage au sort Coupe d'Algérie Régionale",
      labels: ["INBOX", "UNREAD"],
      isUnread: true,
      hasAttachments: true,
      receivedAt: new Date(),
      bodyText: "Messieurs,\n\nVous êtes priés de désigner un représentant pour le tirage au sort...",
      bodyHtml: "<p>Messieurs,</p><p>Vous êtes priés de désigner un représentant pour le tirage au sort prévu ce samedi à 10h.</p>",
      attachments: [
        {
          id: "att-001",
          messageId: msgId,
          filename: "convocation-officielle.pdf",
          mimeType: "application/pdf",
          size: 104857
        }
      ]
    };

    this.mockMessages.set(msgId, msg);
    this.mockThreads.set(threadId, {
      id: threadId,
      historyId: "1000",
      messages: [msg],
      subject: msg.subject,
      participants: [msg.sender, msg.recipient],
      lastMessageDate: msg.receivedAt,
      isUnread: true,
      messageCount: 1
    });

    this.mockAttachments.set(`${msgId}:att-001`, Buffer.from("%PDF-1.4 mock content"));

    // Message 2: FAF Licences
    const msg2Id = "msg-esh-002";
    const thread2Id = "thread-esh-002";
    const msg2: GmailMessageDetail = {
      id: msg2Id,
      threadId: thread2Id,
      snippet: "Validation des dossiers médicaux et délivrance des licences...",
      internalDate: (Date.now() - 1000 * 60 * 60 * 3).toString(),
      sender: { name: "Fédération Algérienne de Football (FAF)", email: "licences@faf.dz" },
      recipient: { name: "ESH Secrétariat", email: "secretariat@esh-sydihosni.dz" },
      to: ["secretariat@esh-sydihosni.dz"],
      cc: [],
      bcc: [],
      subject: "Validation des dossiers médicaux & Licences Seniors 2026/2027",
      labels: ["INBOX"],
      isUnread: false,
      hasAttachments: true,
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
      bodyText: "Monsieur le Président,\n\nNous vous informons que les dossiers médicaux déposés pour l'effectif Senior ont été validés avec succès par la Commission Médicale Fédérale.\n\nCommission Fédérale des Licences",
      bodyHtml: "<p>Monsieur le Président de l'ES Sidi Hosni,</p><p>Nous vous confirmons la validation de l'ensemble des dossiers médicaux et demandes de licences pour votre effectif Senior pour la saison 2026/2027.</p><p>Les licences sont disponibles en téléchargement sur le portail fédéral.</p>",
      attachments: [
        {
          id: "att-002",
          messageId: msg2Id,
          filename: "bordereau-licences.pdf",
          mimeType: "application/pdf",
          size: 78200
        }
      ]
    };
    this.mockMessages.set(msg2Id, msg2);
    this.mockThreads.set(thread2Id, {
      id: thread2Id,
      historyId: "1001",
      messages: [msg2],
      subject: msg2.subject,
      participants: [msg2.sender, msg2.recipient],
      lastMessageDate: msg2.receivedAt,
      isUnread: false,
      messageCount: 1
    });
    this.mockAttachments.set(`${msg2Id}:att-002`, Buffer.from("%PDF-1.4 licences"));

    // Message 3: Friendly match request
    const msg3Id = "msg-esh-003";
    const thread3Id = "thread-esh-003";
    const msg3: GmailMessageDetail = {
      id: msg3Id,
      threadId: thread3Id,
      snippet: "Proposition d'organisation d'un match amical préparatoire ce vendredi...",
      internalDate: (Date.now() - 1000 * 60 * 60 * 24).toString(),
      sender: { name: "MC Saïda — Direction Sportive", email: "contact@mc-saida.dz" },
      recipient: { name: "ESH Secrétariat", email: "secretariat@esh-sydihosni.dz" },
      to: ["secretariat@esh-sydihosni.dz"],
      cc: [],
      bcc: [],
      subject: "Demande de match amical de préparation — Vendredi",
      labels: ["INBOX", "STARRED"],
      isUnread: false,
      hasAttachments: false,
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      bodyText: "Bonjour,\n\nDans le cadre des préparatifs d'avant-saison, nous sollicitons une rencontre amicale entre nos deux équipes seniors ce vendredi à 16h00.\n\nSportivement,\nMC Saïda",
      bodyHtml: "<p>Bonjour,</p><p>Dans le cadre des préparatifs d'avant-saison, nous vous proposons une rencontre amicale entre nos équipes premières ce vendredi à 16h00 au stade des Frères Braci.</p><p>Dans l'attente de votre confirmation rapide.</p>",
      attachments: []
    };
    this.mockMessages.set(msg3Id, msg3);
    this.mockThreads.set(thread3Id, {
      id: thread3Id,
      historyId: "1002",
      messages: [msg3],
      subject: msg3.subject,
      participants: [msg3.sender, msg3.recipient],
      lastMessageDate: msg3.receivedAt,
      isUnread: false,
      messageCount: 1
    });

    // Message 4: Sent message
    const msg4Id = "msg-esh-004";
    const thread4Id = "thread-esh-004";
    const msg4: GmailMessageDetail = {
      id: msg4Id,
      threadId: thread4Id,
      snippet: "Confirmation d'engagement des catégories jeunes et senior...",
      internalDate: (Date.now() - 1000 * 60 * 60 * 48).toString(),
      sender: { name: "ESH Secrétariat", email: "secretariat@esh-sydihosni.dz" },
      recipient: { name: "Ligue Régionale de Saïda", email: "secretariat@ligue-saida.dz" },
      to: ["secretariat@ligue-saida.dz"],
      cc: [],
      bcc: [],
      subject: "Confirmation d'engagement — Saison 2026/2027",
      labels: ["SENT"],
      isUnread: false,
      hasAttachments: true,
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      bodyText: "Veuillez trouver ci-joint l'engagement officiel de l'ES Sidi Hosni pour la nouvelle saison.\n\nSecrétariat Général ESH",
      bodyHtml: "<p>Veuillez trouver ci-joint l'engagement officiel de l'ES Sidi Hosni pour la nouvelle saison sportive ainsi que les quittances de paiement.</p>",
      attachments: [
        {
          id: "att-004",
          messageId: msg4Id,
          filename: "fiche-engagement-esh.pdf",
          mimeType: "application/pdf",
          size: 142000
        }
      ]
    };
    this.mockMessages.set(msg4Id, msg4);
    this.mockThreads.set(thread4Id, {
      id: thread4Id,
      historyId: "1003",
      messages: [msg4],
      subject: msg4.subject,
      participants: [msg4.sender, msg4.recipient],
      lastMessageDate: msg4.receivedAt,
      isUnread: false,
      messageCount: 1
    });
    this.mockAttachments.set(`${msg4Id}:att-004`, Buffer.from("%PDF-1.4 engagement"));
  }

  async exchangeCodeForTokens(code: string, _redirectUri: string) {
    if (this.shouldFailAuth || code === "invalid-code") {
      throw new GmailApiError("Invalid authorization code", 400);
    }
    return {
      accessToken: "mock-access-token-12345",
      refreshToken: this.mockRefreshToken,
      emailAddress: this.mockEmailAddress,
      scope: "https://www.googleapis.com/auth/gmail.modify"
    };
  }

  async refreshAccessToken(refreshToken: string) {
    if (this.shouldFailAuth || refreshToken === "revoked-token") {
      throw new GmailAuthRevokedError();
    }
    return "mock-refreshed-access-token-99999";
  }

  async getProfile(_accessToken: string) {
    return {
      emailAddress: this.mockEmailAddress,
      historyId: "1050"
    };
  }

  async listMessages(
    _accessToken: string,
    options: { maxResults?: number; pageToken?: string; q?: string; labelIds?: string[] } = {}
  ) {
    if (this.shouldFailAuth) throw new GmailAuthRevokedError();
    if (this.shouldFailRateLimit) throw new GmailRateLimitError();

    let list = Array.from(this.mockMessages.values());

    if (options.labelIds && options.labelIds.length > 0) {
      list = list.filter((m) => options.labelIds!.some((l) => m.labels.includes(l)));
    }
    if (options.q) {
      const q = options.q.toLowerCase();
      list = list.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          m.snippet.toLowerCase().includes(q) ||
          m.sender.email.toLowerCase().includes(q)
      );
    }

    return {
      messages: list.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        snippet: m.snippet,
        internalDate: m.internalDate,
        sender: m.sender,
        recipient: m.recipient,
        subject: m.subject,
        labels: m.labels,
        isUnread: m.isUnread,
        hasAttachments: m.hasAttachments,
        receivedAt: m.receivedAt
      })),
      resultSizeEstimate: list.length
    };
  }

  async getMessage(_accessToken: string, messageId: string) {
    if (this.shouldFailAuth) throw new GmailAuthRevokedError();
    const msg = this.mockMessages.get(messageId);
    if (!msg) throw new GmailNotFoundError();
    return msg;
  }

  async getThread(_accessToken: string, threadId: string) {
    if (this.shouldFailAuth) throw new GmailAuthRevokedError();
    let thread = this.mockThreads.get(threadId);
    if (!thread) {
      const msg = this.mockMessages.get(threadId);
      if (msg) {
        thread = this.mockThreads.get(msg.threadId);
      }
    }
    if (!thread) throw new GmailNotFoundError();
    return thread;
  }

  async modifyThreadLabels(
    _accessToken: string,
    threadId: string,
    addLabels: string[] = [],
    removeLabels: string[] = []
  ) {
    if (this.shouldFailAuth) throw new GmailAuthRevokedError();
    const thread = this.mockThreads.get(threadId);
    if (!thread) throw new GmailNotFoundError();

    for (const msg of thread.messages) {
      msg.labels = msg.labels.filter((l) => !removeLabels.includes(l));
      for (const add of addLabels) {
        if (!msg.labels.includes(add)) msg.labels.push(add);
      }
      msg.isUnread = msg.labels.includes("UNREAD");
    }
    thread.isUnread = thread.messages.some((m) => m.isUnread);
  }

  async trashMessage(_accessToken: string, messageId: string) {
    if (this.shouldFailAuth) throw new GmailAuthRevokedError();
    const msg = this.mockMessages.get(messageId);
    if (msg) {
      msg.labels = msg.labels.filter((l) => l !== "INBOX").concat("TRASH");
    }
  }

  async trashThread(_accessToken: string, threadId: string) {
    if (this.shouldFailAuth) throw new GmailAuthRevokedError();
    const thread = this.mockThreads.get(threadId);
    if (thread) {
      for (const msg of thread.messages) {
        msg.labels = msg.labels.filter((l) => l !== "INBOX").concat("TRASH");
      }
    }
  }

  async sendEmail(_accessToken: string, email: SendEmailInput) {
    if (this.shouldFailAuth) throw new GmailAuthRevokedError();
    this.sentEmails.push(email);

    const messageId = `msg-sent-${Date.now()}`;
    const threadId = email.threadId || `thread-sent-${Date.now()}`;

    const newMsg: GmailMessageDetail = {
      id: messageId,
      threadId,
      snippet: email.bodyText?.slice(0, 100) || "",
      internalDate: Date.now().toString(),
      sender: { name: "ESH Secrétariat", email: "secretariat@esh-sydihosni.dz" },
      recipient: { email: email.to[0] || "" },
      to: email.to,
      cc: email.cc || [],
      bcc: email.bcc || [],
      subject: email.subject,
      labels: ["SENT"],
      isUnread: false,
      hasAttachments: false,
      receivedAt: new Date(),
      bodyText: email.bodyText,
      bodyHtml: sanitizeEmailHtml(email.bodyHtml),
      attachments: []
    };

    this.mockMessages.set(messageId, newMsg);

    const existingThread = this.mockThreads.get(threadId);
    if (existingThread) {
      existingThread.messages.push(newMsg);
      existingThread.lastMessageDate = new Date();
      existingThread.messageCount = existingThread.messages.length;
    } else {
      this.mockThreads.set(threadId, {
        id: threadId,
        messages: [newMsg],
        subject: email.subject,
        participants: [newMsg.sender, newMsg.recipient],
        lastMessageDate: new Date(),
        isUnread: false,
        messageCount: 1
      });
    }

    return { messageId, threadId };
  }

  async getAttachment(_accessToken: string, messageId: string, attachmentId: string) {
    if (this.shouldFailAuth) throw new GmailAuthRevokedError();
    const key = `${messageId}:${attachmentId}`;
    const data = this.mockAttachments.get(key);
    if (!data) throw new GmailNotFoundError("Attachment not found");
    return { data, size: data.length };
  }

  async listHistory(_accessToken: string, startHistoryId: string, _pageToken?: string) {
    return {
      historyId: (parseInt(startHistoryId, 10) + 1).toString(),
      messagesAdded: []
    };
  }
}

// ----------------------------------------------------------------------------
// SINGLETON / CLIENT INJECTION
// ----------------------------------------------------------------------------

let customGmailClient: IGmailClient | null = null;
const defaultMockClient = new MockGmailApiClient();
const defaultGoogleClient = new GoogleGmailApiClient();

export function getGmailClient(): IGmailClient {
  if (customGmailClient) return customGmailClient;
  const useMockClient = process.env.NODE_ENV === "test" ||
    (process.env.NODE_ENV !== "production" && process.env.GMAIL_USE_MOCK?.trim().toLowerCase() === "true");
  if (useMockClient) {
    return defaultMockClient;
  }
  return defaultGoogleClient;
}

export function setGmailClient(client: IGmailClient | null): void {
  customGmailClient = client;
}
