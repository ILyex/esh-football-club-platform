import "server-only";

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getFAFConfig } from "./config";
import { db } from "@/lib/db";
import type { FAFSessionRecord, FAFSessionDTO, FAFSessionStatus } from "./types";

// ============================================================================
// PHASE 10B — FAF SESSION MANAGER (AUTHENTICATED SESSION LIFECYCLE)
// ----------------------------------------------------------------------------
// Manages encrypted session persistence, sliding-window keep-alive,
// health validation, atomic session rotation, and safe fail-closed transitions.
//
// Never exposes session cookies, CSRF tokens, or secrets to client or logs.
// ============================================================================

const SESSION_FILE_PATH = path.join(process.cwd(), ".faf-session.enc");

/**
 * Derives a 256-bit symmetric encryption key from environment secrets.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.FAF_SESSION_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("FAF session encryption requires FAF_SESSION_ENCRYPTION_KEY or AUTH_SECRET with at least 32 characters");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a sensitive string using AES-256-GCM.
 * Output: `${ivHex}:${authTagHex}:${encryptedHex}`
 */
export function encryptData(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
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
 */
export function decryptData(cipherString: string): string {
  const parts = cipherString.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed cipher string format");
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

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

export class FAFSessionManagerImpl {
  private inMemoryRecord: FAFSessionRecord | null = null;
  private isLoaded = false;
  private customFilePath?: string;

  constructor(customFilePath?: string) {
    this.customFilePath = customFilePath;
  }

  public getFilePath(): string {
    return this.customFilePath || SESSION_FILE_PATH;
  }

  public resetInMemory(): void {
    this.inMemoryRecord = null;
    this.isLoaded = false;
  }

  /**
   * Loads the encrypted session from disk or bootstraps from environment.
   */
  private async usesDatabasePersistence(): Promise<boolean> {
    if (this.customFilePath) return false;
    // Deno Deploy instances can scale to zero and do not share a writable
    // project directory. Persist the encrypted FAF session in PostgreSQL.
    if (process.env.DENO_DEPLOY === "true" || process.env.DEPLOY_TARGET === "deno") {
      return true;
    }
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const context = await getCloudflareContext({ async: true });
      return Boolean((context.env as { HYPERDRIVE?: unknown }).HYPERDRIVE);
    } catch (error) {
      if (process.env.DEPLOY_TARGET === "cloudflare") {
        throw new Error("Cloudflare context is unavailable for FAF session persistence.", { cause: error });
      }
      return false;
    }
  }

  private async loadSessionRecord(): Promise<FAFSessionRecord | null> {
    if (this.isLoaded) {
      return this.inMemoryRecord;
    }

    if (await this.usesDatabasePersistence()) {
      const stored = await db.integrationState.findUnique({ where: { key: "faf-session" }, select: { value: true } });
      if (stored?.value) {
        try {
          const parsed = JSON.parse(decryptData(stored.value)) as FAFSessionRecord;
          if (parsed && parsed.sessionCookie) {
            this.inMemoryRecord = parsed;
            this.isLoaded = true;
            return parsed;
          }
        } catch {
          // Corrupt or invalidated ciphertext fails closed as no session.
        }
      }
      this.isLoaded = true;
      const config = getFAFConfig();
      if (config.sessionCookie) {
        const now = new Date().toISOString();
        const bootstrapped: FAFSessionRecord = {
          sessionCookie: config.sessionCookie,
          authenticatedAt: now,
          lastVerifiedAt: now,
          lastActiveAt: now,
          clubCode: config.clubCode
        };
        await this.saveSessionRecord(bootstrapped);
        return bootstrapped;
      }
      return null;
    }

    const filePath = this.getFilePath();

    // 1. Try reading encrypted file from disk
    if (fs.existsSync(filePath)) {
      try {
        const rawCipher = fs.readFileSync(filePath, "utf8").trim();
        if (rawCipher) {
          const decrypted = decryptData(rawCipher);
          const parsed = JSON.parse(decrypted) as FAFSessionRecord;
          if (parsed && parsed.sessionCookie) {
            this.inMemoryRecord = parsed;
            this.isLoaded = true;
            return parsed;
          }
        }
      } catch {
        // Tampered or invalid key — ignore corrupt file
      }
    }

    // 2. Fall back to environment configuration if configured (only if default path is used)
    if (!this.customFilePath) {
      const config = getFAFConfig();
      if (config.sessionCookie) {
        const now = new Date().toISOString();
        const bootstrapped: FAFSessionRecord = {
          sessionCookie: config.sessionCookie,
          authenticatedAt: now,
          lastVerifiedAt: now,
          lastActiveAt: now,
          clubCode: config.clubCode
        };
        this.inMemoryRecord = bootstrapped;
        this.isLoaded = true;
        void this.saveSessionRecord(bootstrapped);
        return bootstrapped;
      }
    }

    this.isLoaded = true;
    return null;
  }

  /**
   * Persists the session record encrypted on disk atomically.
   */
  private async saveSessionRecord(record: FAFSessionRecord | null): Promise<void> {
    this.inMemoryRecord = record;
    this.isLoaded = true;

    if (await this.usesDatabasePersistence()) {
      if (!record) {
        await db.integrationState.deleteMany({ where: { key: "faf-session" } });
        return;
      }
      const value = encryptData(JSON.stringify(record));
      await db.integrationState.upsert({
        where: { key: "faf-session" },
        create: { key: "faf-session", value },
        update: { value }
      });
      return;
    }

    const filePath = this.getFilePath();

    if (!record) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {}
      }
      return;
    }

    try {
      const serialized = JSON.stringify(record);
      const encrypted = encryptData(serialized);
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, encrypted, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(tempPath, filePath);
    } catch {
      // In read-only or serverless filesystem, session remains in-memory
    }
  }

  /**
   * Returns the current session cookie string for internal HTTP transport.
   */
  public async getSession(): Promise<string | null> {
    const record = await this.loadSessionRecord();
    return record?.sessionCookie ?? null;
  }

  /**
   * Updates and persists an authenticated session from user handoff.
   */
  public async updateSession(newCookie: string, clubCode?: string): Promise<FAFSessionDTO> {
    const cleanCookie = newCookie.trim().replace(/^(?:authCookie|PHPSESSID)=/i, (prefix) => prefix.split("=")[0] + "=");
    if (!cleanCookie) {
      throw new Error("Cannot set empty FAF session cookie");
    }

    const now = new Date().toISOString();
    const config = getFAFConfig();
    const record: FAFSessionRecord = {
      sessionCookie: cleanCookie,
      authenticatedAt: now,
      lastVerifiedAt: now,
      lastActiveAt: now,
      clubCode: clubCode || config.clubCode
    };

    await this.saveSessionRecord(record);

    // Validate immediately
    const validation = await this.validateSession();
    return this.getStatus(validation.status, validation.message);
  }

  /**
   * Validates the active session against FAF Connect without mutating data.
   */
  public async validateSession(): Promise<{
    valid: boolean;
    status: FAFSessionStatus;
    message: string;
    statusCode: number;
  }> {
    const record = await this.loadSessionRecord();
    if (!record?.sessionCookie) {
      return {
        valid: false,
        status: "NOT_CONFIGURED",
        message: "No FAF session is currently configured",
        statusCode: 401
      };
    }

    const config = getFAFConfig();
    const cookieHeader = /^(?:authCookie|PHPSESSID)=/i.test(record.sessionCookie)
      ? record.sessionCookie
      : `authCookie=${record.sessionCookie}`;

    try {
      const res = await fetch(`${config.portalUrl}/api/filters`, {
        method: "GET",
        headers: {
          "User-Agent": config.userAgent,
          Cookie: cookieHeader
        },
        redirect: "manual",
        signal: AbortSignal.timeout(Math.min(config.timeoutMs, 10000))
      });

      const location = res.headers.get("location") || "";

      if (res.status === 302 || location.includes("/login")) {
        return {
          valid: false,
          status: "REAUTH_REQUIRED",
          message: "FAF authentication has expired and requires re-authentication",
          statusCode: 302
        };
      }

      if (res.status === 200) {
        record.lastVerifiedAt = new Date().toISOString();
        record.lastActiveAt = new Date().toISOString();
        await this.saveSessionRecord(record);

        return {
          valid: true,
          status: "AUTHENTICATED",
          message: "FAF session verified active and authenticated",
          statusCode: res.status
        };
      }

      return {
        valid: false,
        status: "ERROR",
        message: `FAF returned unexpected status HTTP ${res.status}`,
        statusCode: res.status
      };
    } catch (err: any) {
      return {
        valid: false,
        status: "ERROR",
        message: `FAF connection error: ${err.message}`,
        statusCode: 500
      };
    }
  }

  /**
   * Heartbeat to extend the sliding-window expiration timer.
   * In PHP sessions, touching an authenticated page resets the idle timeout.
   */
  public async keepAlive(): Promise<{ success: boolean; message: string }> {
    const record = await this.loadSessionRecord();
    if (!record?.sessionCookie) {
      return { success: false, message: "No active session to keep alive" };
    }

    const config = getFAFConfig();
    try {
      const res = await fetch(`${config.portalUrl}/api/filters`, {
        method: "GET",
        headers: {
          "User-Agent": config.userAgent,
          Cookie: /^(?:authCookie|PHPSESSID)=/i.test(record.sessionCookie) ? record.sessionCookie : `authCookie=${record.sessionCookie}`
        },
        redirect: "manual",
        signal: AbortSignal.timeout(Math.min(config.timeoutMs, 5000))
      });

      if (res.ok || res.status === 200) {
        record.lastActiveAt = new Date().toISOString();
        await this.saveSessionRecord(record);
        return { success: true, message: "FAF session heartbeat successful" };
      }

      const location = res.headers.get("location") || "";
      if (res.status === 302 && location.includes("login.php")) {
        return { success: false, message: "Session expired during heartbeat" };
      }

      return { success: false, message: `Heartbeat responded with HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, message: `Heartbeat network error: ${err.message}` };
    }
  }

  /**
   * Refreshes the session using FAF official response headers if available.
   */
  public async refreshSession(): Promise<{ success: boolean; message: string }> {
    return this.keepAlive();
  }

  /**
   * Detects whether automated re-authentication is possible.
   * Since FAF enforces Google Invisible reCAPTCHA, automated headless reauth
   * is prohibited. Fails closed with REAUTH_REQUIRED.
   */
  public async reauthenticate(): Promise<{
    success: boolean;
    status: FAFSessionStatus;
    message: string;
    requiresHuman: boolean;
  }> {
    return {
      success: false,
      status: "REAUTH_REQUIRED",
      message: "FAF authentication requires human browser verification (Google reCAPTCHA)",
      requiresHuman: true
    };
  }

  /**
   * Invalidates and wipes the active session.
   */
  public async invalidateSession(): Promise<void> {
    await this.saveSessionRecord(null);
  }

  /**
   * Returns a safe DTO without secret cookies for telemetry, UI, and diagnostics.
   */
  public async getStatus(overrideStatus?: FAFSessionStatus, overrideMessage?: string): Promise<FAFSessionDTO> {
    const record = await this.loadSessionRecord();
    const config = getFAFConfig();

    if (!record?.sessionCookie) {
      return {
        status: "NOT_CONFIGURED",
        isConfigured: false,
        authenticatedAt: null,
        lastVerifiedAt: null,
        expiresInMinutes: null,
        clubCode: config.clubCode || null,
        message: "FAF integration is not authenticated"
      };
    }

    // Estimate expiration based on last activity (PHP 24-minute idle window)
    let expiresInMinutes = 24;
    if (record.lastActiveAt) {
      const elapsedMinutes = (Date.now() - new Date(record.lastActiveAt).getTime()) / 60000;
      expiresInMinutes = Math.max(0, Math.round(24 - elapsedMinutes));
    }

    let status: FAFSessionStatus = overrideStatus || "AUTHENTICATED";
    if (!overrideStatus) {
      if (expiresInMinutes <= 0) {
        status = "EXPIRED";
      } else if (expiresInMinutes < 5) {
        status = "EXPIRING";
      }
    }

    return {
      status,
      isConfigured: true,
      authenticatedAt: record.authenticatedAt || null,
      lastVerifiedAt: record.lastVerifiedAt || null,
      expiresInMinutes,
      clubCode: record.clubCode || config.clubCode || null,
      message: overrideMessage || (status === "AUTHENTICATED" ? "Session is active and valid" : "Re-authentication required")
    };
  }
}

export const FAFSessionManager = new FAFSessionManagerImpl();
