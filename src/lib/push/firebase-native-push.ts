import "server-only";

import { createSign } from "node:crypto";

type ServiceAccount = { project_id?: string; client_email?: string; private_key?: string; token_uri?: string };
type FcmMessage = { token: string; title: string; body: string; section?: string; tag?: string };

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const account = JSON.parse(raw) as ServiceAccount;
    if (!account.project_id || !account.client_email || !account.private_key) return null;
    return { ...account, token_uri: account.token_uri || "https://oauth2.googleapis.com/token" };
  } catch {
    return null;
  }
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.value;
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: account.token_uri,
    iat: issuedAt,
    exp: issuedAt + 3600
  })).toString("base64url");
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key!.replace(/\\n/g, "\n")).toString("base64url")}`;
  const response = await fetch(account.token_uri!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  if (!response.ok) throw new Error(`Firebase OAuth returned HTTP ${response.status}.`);
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Firebase OAuth did not return an access token.");
  cachedAccessToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
  return payload.access_token;
}

/** Sends native system notifications through FCM when the deployment has its service account configured. */
export async function sendNativePush(messages: FcmMessage[]): Promise<{ configured: boolean; failed: number; errors: string[] }> {
  const eligibleMessages = messages.filter((message) => message.section === "matches" || message.section === "meetings");
  if (eligibleMessages.length === 0) return { configured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON), failed: 0, errors: [] };
  const account = loadServiceAccount();
  if (!account) return { configured: false, failed: 0, errors: [] };
  const accessToken = await getAccessToken(account);
  const results = await Promise.allSettled(eligibleMessages.map(async (message) => {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id!)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: {
        token: message.token,
        // Use a data-only message so NativeMessagingService can render the branded,
        // high-priority notification consistently while the app is backgrounded.
        data: { section: message.section!, title: message.title, body: message.body, ...(message.tag ? { tag: message.tag } : {}) },
        android: { priority: "high" }
      } })
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null) as { error?: { status?: string } } | null;
      throw new Error(`FCM HTTP ${response.status}${errorBody?.error?.status ? ` (${errorBody.error.status})` : ""}`);
    }
  }));
  const errors = results.flatMap((result) => result.status === "rejected"
    ? [result.reason instanceof Error ? result.reason.message : "FCM request failed"]
    : []);
  return { configured: true, failed: errors.length, errors };
}
