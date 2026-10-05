import "server-only";
import crypto from "crypto";

// ============================================================================
// PHASE 11 — GMAIL INTEGRATION: REFRESH TOKEN ENCRYPTION (AES-256-GCM)
// ============================================================================

/**
 * Derives a 256-bit symmetric encryption key from environment secrets.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim() || process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Gmail token encryption requires GMAIL_TOKEN_ENCRYPTION_KEY or AUTH_SECRET with at least 32 characters");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a sensitive plaintext string (such as an OAuth refresh token)
 * using authenticated AES-256-GCM.
 *
 * Output format: `${ivHex}:${authTagHex}:${encryptedHex}`
 */
export function encryptToken(plainText: string): string {
  if (!plainText) {
    throw new Error("Cannot encrypt empty token");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM cipher string.
 *
 * Verifies authenticity via GCM auth tag. Throws on tampering or key mismatch.
 */
export function decryptToken(cipherString: string): string {
  if (!cipherString) {
    throw new Error("Cannot decrypt empty token payload");
  }

  const parts = cipherString.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed cipher string format: expected iv:tag:payload");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Corrupt cipher string components");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    throw new Error("Token decryption failed: authentication tag verification failed (tampered data or wrong key)");
  }
}
