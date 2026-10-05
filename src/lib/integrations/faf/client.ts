import "server-only";

import { getFAFConfig } from "./config";
import type { FAFLicenceData, FAFStaffLicenceData, FAFMatchFixtureData, FAFMatchSheetData } from "./types";
import { fafPlayerLicenceSchema, fafStaffLicenceSchema, fafMatchFixtureSchema, fafMatchSheetSchema } from "./schemas";

// ============================================================================
// PHASE 10B — FAF CLIENT ADAPTER
// ----------------------------------------------------------------------------
// Isolates HTTP transport, session state, rate limits, and network errors.
// The domain layers never interact with raw external endpoints.
// ============================================================================

import { FAFSessionManager } from "./session-manager";

export interface FAFClient {
  readonly name: string;
  isConfigured(): boolean;
  checkConnection(): Promise<{ connected: boolean; message: string; latencyMs: number }>;
  fetchPlayers(category?: string): Promise<FAFLicenceData[]>;
  fetchStaff(): Promise<FAFStaffLicenceData[]>;
  fetchMatches(seasonLabel?: string): Promise<FAFMatchFixtureData[]>;
  fetchMatchSheet(fafMatchId: string): Promise<FAFMatchSheetData | null>;
  validateSession?(): Promise<{ valid: boolean; message: string; statusCode: number }>;
}

export class FAFHttpAdapter implements FAFClient {
  public readonly name = "faf-http-adapter";
  private sessionCookie: string | null = null;
  private sessionExpiresAt: number = 0;

  public isConfigured(): boolean {
    const config = getFAFConfig();
    return config.enabled && config.hasCredentials;
  }

  public async getSessionCookie(): Promise<string | null> {
    if (this.sessionCookie) return this.sessionCookie;
    const stored = await FAFSessionManager.getSession();
    if (stored) return stored;
    const config = getFAFConfig();
    return config.sessionCookie || null;
  }

  public setSessionCookie(cookie: string): void {
    this.sessionCookie = cookie.trim();
    void FAFSessionManager.updateSession(cookie.trim());
  }

  public async validateSession(): Promise<{ valid: boolean; message: string; statusCode: number }> {
    const result = await FAFSessionManager.validateSession();
    return {
      valid: result.valid,
      message: result.message,
      statusCode: result.statusCode
    };
  }

  public async checkConnection(): Promise<{ connected: boolean; message: string; latencyMs: number }> {
    const config = getFAFConfig();
    if (!config.enabled) {
      return { connected: false, message: "FAF integration is disabled in configuration", latencyMs: 0 };
    }
    if (!config.hasCredentials) {
      return { connected: false, message: "FAF club credentials are not configured", latencyMs: 0 };
    }

    const start = Date.now();
    try {
      const res = await fetch(`${config.portalUrl}/login.php`, {
        method: "HEAD",
        headers: { "User-Agent": config.userAgent },
        signal: AbortSignal.timeout(Math.min(config.timeoutMs, 5000))
      });
      const latencyMs = Date.now() - start;
      const isReachable = res.ok || res.status === 302 || res.status === 404 || res.status === 403;
      return {
        connected: isReachable,
        message: isReachable ? `FAF portal reachable (HTTP ${res.status})` : `FAF portal returned ${res.status}`,
        latencyMs
      };
    } catch (err: any) {
      return {
        connected: false,
        message: err.name === "TimeoutError" ? "Connection timed out" : `FAF portal unreachable: ${err.message}`,
        latencyMs: Date.now() - start
      };
    }
  }

  public async fetchPlayers(category?: string): Promise<FAFLicenceData[]> {
    if (!this.isConfigured()) {
      throw new Error("FAF integration is not configured with valid club credentials");
    }
    const sessionCheck = await this.validateSession();
    if (!sessionCheck.valid) {
      throw new Error(`FAF session invalid: ${sessionCheck.message}`);
    }
    void category;
    throw new Error("FAF_DATA_ENDPOINT_UNAVAILABLE: player data API is not implemented; no player data was imported.");
  }

  public async fetchStaff(): Promise<FAFStaffLicenceData[]> {
    if (!this.isConfigured()) {
      throw new Error("FAF integration is not configured with valid club credentials");
    }
    const sessionCheck = await this.validateSession();
    if (!sessionCheck.valid) {
      throw new Error(`FAF session invalid: ${sessionCheck.message}`);
    }
    throw new Error("FAF_DATA_ENDPOINT_UNAVAILABLE: staff data API is not implemented; no staff data was imported.");
  }

  public async fetchMatches(seasonLabel?: string): Promise<FAFMatchFixtureData[]> {
    if (!this.isConfigured()) {
      throw new Error("FAF integration is not configured with valid club credentials");
    }
    const sessionCheck = await this.validateSession();
    if (!sessionCheck.valid) {
      throw new Error(`FAF session invalid: ${sessionCheck.message}`);
    }
    throw new Error("FAF_DATA_ENDPOINT_UNAVAILABLE: fixture data API is not implemented; no matches were imported.");
  }

  public async fetchMatchSheet(fafMatchId: string): Promise<FAFMatchSheetData | null> {
    if (!this.isConfigured()) {
      throw new Error("FAF integration is not configured with valid club credentials");
    }
    const sessionCheck = await this.validateSession();
    if (!sessionCheck.valid) {
      throw new Error(`FAF session invalid: ${sessionCheck.message}`);
    }
    throw new Error("FAF_DATA_ENDPOINT_UNAVAILABLE: match-sheet API is not implemented; no match data was imported.");
  }
}

/**
 * Deterministic test adapter for automated regression, validation,
 * and security test suites.
 */
export class FAFMockAdapter implements FAFClient {
  public readonly name = "faf-mock-adapter";
  public mockPlayers: FAFLicenceData[] = [];
  public mockStaff: FAFStaffLicenceData[] = [];
  public mockMatches: FAFMatchFixtureData[] = [];
  public mockMatchSheets: Map<string, FAFMatchSheetData> = new Map();
  public simulateFailure: boolean = false;
  public failureMessage: string = "Simulated network failure";

  public isConfigured(): boolean {
    return true;
  }

  public async checkConnection(): Promise<{ connected: boolean; message: string; latencyMs: number }> {
    if (this.simulateFailure) {
      return { connected: false, message: this.failureMessage, latencyMs: 10 };
    }
    return { connected: true, message: "Mock FAF portal active", latencyMs: 5 };
  }

  public async fetchPlayers(category?: string): Promise<FAFLicenceData[]> {
    if (this.simulateFailure) throw new Error(this.failureMessage);
    const players = category
      ? this.mockPlayers.filter((p) => p.category.toUpperCase() === category.toUpperCase())
      : this.mockPlayers;

    // Run each player through Zod schema validation
    return players.map((p) => fafPlayerLicenceSchema.parse(p));
  }

  public async fetchStaff(): Promise<FAFStaffLicenceData[]> {
    if (this.simulateFailure) throw new Error(this.failureMessage);
    return this.mockStaff.map((s) => fafStaffLicenceSchema.parse(s));
  }

  public async fetchMatches(seasonLabel?: string): Promise<FAFMatchFixtureData[]> {
    if (this.simulateFailure) throw new Error(this.failureMessage);
    const matches = seasonLabel
      ? this.mockMatches.filter((m) => m.seasonLabel === seasonLabel)
      : this.mockMatches;
    return matches.map((m) => fafMatchFixtureSchema.parse(m));
  }

  public async fetchMatchSheet(fafMatchId: string): Promise<FAFMatchSheetData | null> {
    if (this.simulateFailure) throw new Error(this.failureMessage);
    const sheet = this.mockMatchSheets.get(fafMatchId);
    if (!sheet) return null;
    return fafMatchSheetSchema.parse(sheet);
  }
}

let activeClient: FAFClient = new FAFHttpAdapter();

export function getFAFClient(): FAFClient {
  return activeClient;
}

export function setFAFClient(client: FAFClient): void {
  activeClient = client;
}
