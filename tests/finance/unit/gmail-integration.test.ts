import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { reset, store } from "../mocks/db";
import { encryptToken, decryptToken } from "@/lib/integrations/gmail/crypto";
import { sanitizeEmailHtml } from "@/lib/integrations/gmail/sanitizer";
import {
  sendEmailSchema,
  replyEmailSchema,
  attachmentDownloadSchema,
  markReadSchema
} from "@/lib/integrations/gmail/schemas";
import {
  MockGmailApiClient,
  setGmailClient,
  GmailAuthRevokedError,
  GmailRateLimitError
} from "@/lib/integrations/gmail/client";
import {
  getGmailConnectionStatus,
  connectOfficialGmail,
  disconnectOfficialGmail,
  listMailboxMessages,
  getMailThread,
  sendOfficialEmail,
  replyToOfficialEmail,
  setThreadReadState,
  getMailAttachment,
  syncGmailInbox
} from "@/lib/integrations/gmail/service";
import type { SessionUser } from "@/lib/permissions";

// Unit tests use an explicit non-production key; production code deliberately
// refuses to encrypt Gmail tokens with a bundled fallback secret.
process.env.GMAIL_TOKEN_ENCRYPTION_KEY = "unit-test-gmail-encryption-key-32-bytes-minimum";

const superAdmin: SessionUser = {
  id: "user-superadmin",
  name: "Super Admin",
  email: "admin@esh.dz",
  roleKey: "super_admin",
  roleName: "Super Admin",
  permissions: ["*"]
};

const secretaryUser: SessionUser = {
  id: "user-sec",
  name: "Secrétaire Général",
  email: "sg@esh.dz",
  roleKey: "secretary",
  roleName: "Secretary",
  permissions: ["mail.view", "mail.send"]
};

const unauthorizedUser: SessionUser = {
  id: "user-coach",
  name: "Coach",
  email: "coach@esh.dz",
  roleKey: "coach",
  roleName: "Coach",
  permissions: ["training.view", "training.manage"]
};

let mockClient: MockGmailApiClient;

beforeEach(() => {
  reset();
  mockClient = new MockGmailApiClient();
  setGmailClient(mockClient);
});

// ----------------------------------------------------------------------------
// 1. REFRESH TOKEN ENCRYPTION & SECURITY (AES-256-GCM)
// ----------------------------------------------------------------------------

test("Token Encryption: AES-256-GCM produces authenticated cipher string", () => {
  const secretRefreshToken = "1//04Gj98KldwJ9823k-super-sensitive-token";
  const encrypted = encryptToken(secretRefreshToken);

  assert.notEqual(encrypted, secretRefreshToken);
  assert.ok(!encrypted.includes("super-sensitive-token"), "Plaintext must not be exposed in cipher");
  assert.equal(encrypted.split(":").length, 3, "Expected iv:authTag:cipher format");

  const decrypted = decryptToken(encrypted);
  assert.equal(decrypted, secretRefreshToken);
});

test("Token Encryption: Tampered cipher or tag fails closed", () => {
  const encrypted = encryptToken("test-refresh-token");
  const [iv, tag, data] = encrypted.split(":");

  // Tamper with data byte
  const tamperedData = data.slice(0, -2) + (data.endsWith("a") ? "b" : "a");
  const tamperedCipher = `${iv}:${tag}:${tamperedData}`;

  assert.throws(() => decryptToken(tamperedCipher), /authentication tag verification failed/);
});

// ----------------------------------------------------------------------------
// 2. HTML SANITIZATION & XSS DEFENSE
// ----------------------------------------------------------------------------

test("Sanitizer: Neutralizes XSS vectors (<script>, onerror, javascript: URLs)", () => {
  const hostilePayload = `
    <div>
      <script>alert('xss')</script>
      <p>Official communication from federation</p>
      <img src="x" onerror="stealCookies()" />
      <a href="javascript:void(0)">Click here for schedule</a>
      <iframe src="http://evil.com"></iframe>
    </div>
  `;

  const sanitized = sanitizeEmailHtml(hostilePayload);

  assert.ok(!sanitized.includes("<script"), "Must strip script tags");
  assert.ok(!sanitized.includes("onerror"), "Must strip inline event handlers");
  assert.ok(!sanitized.includes("javascript:"), "Must strip javascript: schemes");
  assert.ok(!sanitized.includes("<iframe"), "Must strip iframes");
  assert.ok(sanitized.includes("Official communication from federation"), "Preserves safe text");
});

test("Sanitizer: Enforces target='_blank' and rel='noopener' on legitimate links", () => {
  const html = `<p>Visit <a href="https://faf.dz">Federation site</a></p>`;
  const sanitized = sanitizeEmailHtml(html);

  assert.ok(sanitized.includes('target="_blank"'), "Must add target=_blank");
  assert.ok(sanitized.includes('rel="noopener noreferrer nofollow"'), "Must add safe rel attributes");
});

// ----------------------------------------------------------------------------
// 3. HEADER INJECTION & ATTACHMENT VALIDATION SCHEMAS
// ----------------------------------------------------------------------------

test("Validation: Rejects CRLF email header injection in recipients and subject", () => {
  assert.throws(() => {
    sendEmailSchema.parse({
      to: ["legit@test.com\r\nBcc: victim@test.com"],
      subject: "Valid subject",
      bodyText: "Hello"
    });
  }, /Invalid email format/);

  assert.throws(() => {
    sendEmailSchema.parse({
      to: ["legit@test.com"],
      subject: "Injected\r\nSubject",
      bodyText: "Hello"
    });
  }, /Subject contains invalid newline or control characters/);
});

test("Validation: Rejects path traversal in attachment download request", () => {
  assert.throws(() => {
    attachmentDownloadSchema.parse({
      messageId: "msg123",
      attachmentId: "att456",
      filename: "../../../etc/passwd"
    });
  }, /Path traversal in filename is prohibited/);

  // Safe filename passes
  const valid = attachmentDownloadSchema.parse({
    messageId: "msg123",
    attachmentId: "att456",
    filename: "rapport-financier.pdf"
  });
  assert.equal(valid.filename, "rapport-financier.pdf");
});

// ----------------------------------------------------------------------------
// 4. RBAC & PERMISSION BOUNDARIES
// ----------------------------------------------------------------------------

test("RBAC: Unauthorized user without mail.view cannot list or view messages", async () => {
  await assert.rejects(
    async () => listMailboxMessages({}, unauthorizedUser),
    /Forbidden: missing permission "mail.view"/
  );

  await assert.rejects(
    async () => getMailThread("thread-001", unauthorizedUser),
    /Forbidden: missing permission "mail.view"/
  );
});

test("RBAC: User without mail.send cannot send or reply to emails", async () => {
  await assert.rejects(
    async () =>
      sendOfficialEmail(
        { to: ["test@example.com"], subject: "Hello", bodyText: "Test body" },
        unauthorizedUser
      ),
    /Forbidden: missing permission "mail.send"/
  );
});

test("RBAC: User without mail.manage cannot connect or disconnect mailbox", async () => {
  await assert.rejects(
    async () => connectOfficialGmail("valid-code", "http://localhost/callback", secretaryUser),
    /Forbidden: missing permission "mail.manage"/
  );

  await assert.rejects(
    async () => disconnectOfficialGmail(secretaryUser),
    /Forbidden: missing permission "mail.manage"/
  );
});

// ----------------------------------------------------------------------------
// 5. OFFICIAL GMAIL CONNECTION & LIFECYCLE
// ----------------------------------------------------------------------------

test("Connection: Super admin connects official Gmail account and encrypts tokens", async () => {
  const connection = await connectOfficialGmail("oauth-code-123", "http://localhost/callback", superAdmin);

  assert.equal(connection.emailAddress, "secretariat@esh-sydihosni.dz");
  assert.equal(connection.status, "CONNECTED");

  // Verify in database store
  const stored = store.gmailConnection[0];
  assert.ok(stored);
  assert.equal(stored.emailAddress, "secretariat@esh-sydihosni.dz");
  assert.notEqual(stored.encryptedRefreshToken, "mock-refresh-token-67890", "Stored token must be encrypted");

  // Audit log recorded
  const audit = store.auditLog.find((a) => a.action === "GMAIL_CONNECTED");
  assert.ok(audit, "Must log GMAIL_CONNECTED audit entry");
  assert.equal(audit.userId, superAdmin.id);
});

// ----------------------------------------------------------------------------
// 6. READING, SENDING, REPLYING, & AUDIT
// ----------------------------------------------------------------------------

test("Mailbox: Authorized user lists messages, marks read, sends email, and downloads attachment", async () => {
  // Pre-seed connection
  await connectOfficialGmail("oauth-code-123", "http://localhost/callback", superAdmin);

  // 1. List messages
  const list = await listMailboxMessages({ label: "INBOX" }, secretaryUser);
  assert.ok(list.messages.length > 0);
  const first = list.messages[0];
  assert.equal(first.subject, "Convocation — Tirage au sort Coupe d'Algérie Régionale");

  // 2. Mark thread read
  await setThreadReadState(first.threadId, true, secretaryUser);
  const auditRead = store.auditLog.find((a) => a.action === "GMAIL_READ_STATE_CHANGED");
  assert.ok(auditRead);

  // 3. Send new email
  const sendResult = await sendOfficialEmail(
    {
      to: ["ligue@football.dz"],
      subject: "Confirmation de présence ESH",
      bodyText: "Nous confirmons la présence de notre secrétaire général."
    },
    secretaryUser
  );
  assert.ok(sendResult.messageId);
  const auditSent = store.auditLog.find((a) => a.action === "GMAIL_MESSAGE_SENT");
  assert.ok(auditSent);

  // 4. Download attachment
  const attResult = await getMailAttachment(first.id, "att-001", "convocation-officielle.pdf", secretaryUser);
  assert.ok(attResult.data.length > 0);
  const auditAtt = store.auditLog.find((a) => a.action === "GMAIL_ATTACHMENT_ACCESSED");
  assert.ok(auditAtt);
});

// ----------------------------------------------------------------------------
// 7. BACKGROUND SYNC & AUTH REVOCATION HANDLING
// ----------------------------------------------------------------------------

test("Failure Recovery: Catches revoked refresh token and marks connection REVOKED", async () => {
  await connectOfficialGmail("oauth-code-123", "http://localhost/callback", superAdmin);

  // Configure mock client to simulate revoked Google authorization
  mockClient.shouldFailAuth = true;

  await assert.rejects(
    async () => listMailboxMessages({}, secretaryUser),
    /GmailAuthRevokedError/
  );

  // Check connection status in DB was updated to REVOKED
  const connection = store.gmailConnection[0];
  assert.equal(connection.status, "REVOKED");
  assert.ok(connection.lastError?.includes("revoked"));
});

// ----------------------------------------------------------------------------
// 8. REPLACEABLE ACCOUNT & ACCOUNT SWITCHING SAFETY
// ----------------------------------------------------------------------------

test("Account Switching: Connecting Account B replaces Account A without token cross-contamination", async () => {
  // 1. Connect Account A (Test Account)
  mockClient.mockEmailAddress = "test-account-a@gmail.com";
  mockClient.mockRefreshToken = "refresh-token-alpha-111";

  const connA = await connectOfficialGmail("code-a", "http://localhost/callback", superAdmin);
  assert.equal(connA.emailAddress, "test-account-a@gmail.com");
  assert.equal(connA.status, "CONNECTED");

  // Sync Account A
  await syncGmailInbox(superAdmin.id);
  const rowA = store.gmailConnection.find((c) => c.emailAddress === "test-account-a@gmail.com");
  assert.ok(rowA);
  assert.ok(rowA.lastSyncAt);
  assert.equal(rowA.lastHistoryId, "1050");

  // 2. Connect Account B (Official Account) directly without manual disconnect
  mockClient.mockEmailAddress = "contact@esh-club.dz";
  mockClient.mockRefreshToken = "refresh-token-beta-222";

  const connB = await connectOfficialGmail("code-b", "http://localhost/callback", superAdmin);
  assert.equal(connB.emailAddress, "contact@esh-club.dz");
  assert.equal(connB.status, "CONNECTED");

  // 3. Verify Account A is transitioned to DISCONNECTED (zero orphaned active connections)
  assert.equal(rowA.status, "DISCONNECTED", "Account A must be DISCONNECTED when Account B connects");

  const activeConnections = store.gmailConnection.filter((c) => c.status === "CONNECTED");
  assert.equal(activeConnections.length, 1, "Must be exactly ONE active connected account");
  assert.equal(activeConnections[0].emailAddress, "contact@esh-club.dz");

  // 4. Verify Token Isolation: Account B has its OWN encrypted token; tokens are NOT cross-contaminated
  const rowB = store.gmailConnection.find((c) => c.emailAddress === "contact@esh-club.dz");
  assert.ok(rowB);
  assert.notEqual(rowA.encryptedRefreshToken, rowB.encryptedRefreshToken, "Tokens must be independently encrypted");
  assert.equal(decryptToken(rowB.encryptedRefreshToken), "refresh-token-beta-222");
  assert.equal(decryptToken(rowA.encryptedRefreshToken), "refresh-token-alpha-111");

  // 5. Verify History ID Isolation: Account B starts with fresh sync pointer (not Account A's history)
  assert.equal(rowB.lastHistoryId, null, "New account must have null history pointer before its first sync");

  // 6. Verify Connection Status DTO returns active Account B
  const currentStatus = await getGmailConnectionStatus();
  assert.equal(currentStatus.connection?.emailAddress, "contact@esh-club.dz");
  assert.equal(currentStatus.connection?.status, "CONNECTED");

  // 7. Verify Historical Audit Trail: both GMAIL_CONNECTED actions are preserved
  const connectAudits = store.auditLog.filter((a) => a.action === "GMAIL_CONNECTED");
  assert.equal(connectAudits.length, 2, "Must retain historical audit logs for both connection events");

  // 8. Disconnect Account B: All active connections cleanly closed
  await disconnectOfficialGmail(superAdmin);
  assert.equal(rowB.status, "DISCONNECTED");
  assert.equal(store.gmailConnection.filter((c) => c.status === "CONNECTED").length, 0);

  // Calling authenticated actions now fails closed
  await assert.rejects(
    async () => listMailboxMessages({}, secretaryUser),
    /No active official Gmail connection found/
  );
});

