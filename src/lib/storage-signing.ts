import "server-only";
import crypto from "node:crypto";

function getSigningSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Local private downloads require AUTH_SECRET with at least 32 characters");
  }
  return secret;
}

export function signLocalDownload(key: string, expiresAt: number, inline: boolean): string {
  return crypto.createHmac("sha256", getSigningSecret())
    .update(`${key}:${expiresAt}:${inline ? "inline" : "attachment"}`)
    .digest("hex");
}

export function verifyLocalDownloadSignature(key: string, expiresAt: number, inline: boolean, signature: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signLocalDownload(key, expiresAt, inline), "hex");
  const provided = Buffer.from(signature, "hex");
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}
