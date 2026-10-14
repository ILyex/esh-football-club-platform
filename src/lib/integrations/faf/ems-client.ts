import "server-only";

import { getFAFConfig } from "./config";
import { FAFSessionManager } from "./session-manager";

type JsonRecord = Record<string, any>;

function cookiePair(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/(?:^|,\s*)(authCookie|PHPSESSID)=([^;]+)/i);
  return match ? `${match[1]}=${match[2]}` : null;
}

export class FafEmsClient {
  private async login(): Promise<string> {
    const config = getFAFConfig();
    const username = process.env.FAF_USERNAME?.trim();
    const password = process.env.FAF_PASSWORD;
    if (!config.enabled || !username || !password) throw new Error("FAF EMS account credentials are not configured on the server.");

    const form = new FormData();
    form.set("user", username);
    form.set("password", password);
    const response = await fetch(`${config.portalUrl}/api/login`, {
      method: "POST", body: form, redirect: "manual",
      headers: { "User-Agent": config.userAgent },
      signal: AbortSignal.timeout(config.timeoutMs)
    });
    const cookie = cookiePair(response.headers.get("set-cookie"));
    if (!response.ok || !cookie) throw new Error("FAF EMS login failed. Check the account credentials and access to the club account.");
    const body = await response.json().catch(() => null) as JsonRecord | null;
    if (!body || !body.id) throw new Error("FAF EMS did not confirm the account session.");
    await FAFSessionManager.updateSession(cookie, config.clubCode);
    return cookie;
  }

  private async cookie(): Promise<string> {
    const stored = await FAFSessionManager.getSession();
    if (stored) {
      const check = await fetch(`${getFAFConfig().portalUrl}/api/filters`, {
        headers: { Cookie: stored, "User-Agent": getFAFConfig().userAgent },
        signal: AbortSignal.timeout(Math.min(getFAFConfig().timeoutMs, 10000))
      }).catch(() => null);
      if (check?.ok) return stored;
    }
    return this.login();
  }

  private async request(path: string): Promise<Response> {
    const config = getFAFConfig();
    const cookie = await this.cookie();
    const response = await fetch(`${config.portalUrl}${path}`, {
      headers: { Cookie: cookie, "User-Agent": config.userAgent, Accept: "application/json, application/pdf" },
      signal: AbortSignal.timeout(config.timeoutMs),
      redirect: "manual"
    });
    if (response.status === 401 || response.status === 403 || response.status === 302) {
      await FAFSessionManager.invalidateSession();
      throw new Error("FAF EMS session expired or lacks access to this match. Retry to reconnect.");
    }
    if (!response.ok) throw new Error(`FAF EMS returned HTTP ${response.status}.`);
    return response;
  }

  async history(): Promise<JsonRecord[]> {
    const output: JsonRecord[] = [];
    for (let page = 0; page < 30; page++) {
      const response = await this.request(`/api/rencontres/history?page=${page}&pageSize=50`);
      const json = await response.json() as JsonRecord;
      if (!Array.isArray(json.content)) throw new Error("Unexpected FAF EMS match history response.");
      output.push(...json.content);
      if (!json.hasNext || json.content.length === 0) break;
    }
    return output;
  }

  async matchInfo(externalId: number): Promise<JsonRecord> {
    const response = await this.request(`/api/rencontres/match-info?matchId=${encodeURIComponent(externalId)}`);
    const json = await response.json() as JsonRecord;
    if (!json.match || Number(json.match.id) !== externalId) throw new Error("FAF EMS match details do not match the requested match.");
    return json;
  }

  async report(externalId: number, kind: "first-report-ar" | "final-report-ar"): Promise<Buffer> {
    const response = await this.request(`/api/rencontres/${kind}/${encodeURIComponent(externalId)}`);
    const type = response.headers.get("content-type")?.toLowerCase() || "";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!type.includes("application/pdf") || bytes.length < 8 || bytes.length > 25 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== "%PDF-") {
      throw new Error(`FAF EMS ${kind} did not return a valid PDF document.`);
    }
    return bytes;
  }
}

export function getFafEmsClient(): FafEmsClient { return new FafEmsClient(); }