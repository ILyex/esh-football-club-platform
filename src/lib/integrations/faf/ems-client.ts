import "server-only";

import { getFAFConfig } from "./config";
import { FAFSessionManager } from "./session-manager";
import { RetryableError } from "@/lib/jobs/types";
import { isSafeExternalUrl } from "./schemas";

type JsonRecord = Record<string, any>;

function cookiePair(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/(?:^|,\s*)(authCookie|PHPSESSID)=([^;]+)/i);
  return match ? `${match[1]}=${match[2]}` : null;
}

export class FafEmsClient {
  private async fetchRemote(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const message = name === "TimeoutError"
        ? "FAF EMS request timed out; retrying may succeed."
        : "FAF EMS could not be reached; retrying may succeed.";
      throw new RetryableError(message, error);
    }
  }

  private async login(): Promise<string> {
    const config = getFAFConfig();
    const username = process.env.FAF_USERNAME?.trim();
    const password = process.env.FAF_PASSWORD;
    if (!config.enabled) throw new Error("FAF EMS integration is disabled on the server.");
    if (!username || !password) throw new Error("No active saved FAF EMS session is available, and server account credentials are not configured.");

    const form = new FormData();
    form.set("user", username);
    form.set("password", password);
    const response = await this.fetchRemote(`${config.portalUrl}/api/login`, {
      method: "POST", body: form, redirect: "manual",
      headers: { "User-Agent": config.userAgent },
      signal: AbortSignal.timeout(config.timeoutMs)
    });
    if (response.status === 429 || response.status >= 500) {
      throw new RetryableError(`FAF EMS login temporarily returned HTTP ${response.status}.`);
    }
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
      const check = await this.fetchRemote(`${getFAFConfig().portalUrl}/api/filters`, {
        headers: { Cookie: stored, "User-Agent": getFAFConfig().userAgent },
        signal: AbortSignal.timeout(Math.min(getFAFConfig().timeoutMs, 10000))
      }).catch(() => null);
      if (check?.ok) return stored;
    }
    return this.login();
  }

  private async request(path: string): Promise<Response> {
    const config = getFAFConfig();
    const send = (cookie: string) => this.fetchRemote(`${config.portalUrl}${path}`, {
      headers: { Cookie: cookie, "User-Agent": config.userAgent, Accept: "application/json, application/pdf" },
      signal: AbortSignal.timeout(config.timeoutMs),
      redirect: "manual"
    });
    let response = await send(await this.cookie());
    if (response.status === 401 || response.status === 403 || response.status === 302) {
      await FAFSessionManager.invalidateSession();
      response = await send(await this.login());
      if (response.status === 401 || response.status === 403 || response.status === 302) {
        await FAFSessionManager.invalidateSession();
        throw new Error("FAF EMS account lacks access to the requested match or document.");
      }
    }
    if (response.status === 429 || response.status >= 500) {
      throw new RetryableError(`FAF EMS temporarily returned HTTP ${response.status}.`);
    }
    if (!response.ok) throw new Error(`FAF EMS returned HTTP ${response.status}.`);
    return response;
  }

  private async json(response: Response, label: string): Promise<JsonRecord> {
    try {
      return await response.json() as JsonRecord;
    } catch {
      throw new RetryableError(`FAF EMS returned an unreadable ${label} response.`);
    }
  }

  async history(): Promise<JsonRecord[]> {
    const output: JsonRecord[] = [];
    for (let page = 0; page < 30; page++) {
      const response = await this.request(`/api/rencontres/history?page=${page}&pageSize=50`);
      const json = await this.json(response, "match history");
      if (!Array.isArray(json.content)) throw new Error("Unexpected FAF EMS match history response.");
      output.push(...json.content);
      if (!json.hasNext || json.content.length === 0) break;
    }
    return output;
  }

  /** Upcoming EMS fixtures are exposed by the same filtered rencontres feed
   * used by the official Match Sheet client (the history endpoint is past
   * matches only). Keep the look-ahead bounded and paginate defensively. */
  async scheduledMatches(startDate: string, endDate: string): Promise<JsonRecord[]> {
    const output: JsonRecord[] = [];
    for (let page = 0; page < 10; page++) {
      const params = new URLSearchParams({ page: String(page), pageSize: "30", startDate, endDate });
      const response = await this.request(`/api/rencontres?${params.toString()}`);
      const json = await this.json(response, "scheduled matches");
      if (!Array.isArray(json.content)) throw new Error("Unexpected FAF EMS scheduled match response.");
      output.push(...json.content);
      if (!json.hasNext || json.content.length === 0) break;
    }
    return output;
  }

  async matchInfo(externalId: number): Promise<JsonRecord> {
    const response = await this.request(`/api/rencontres/match-info?matchId=${encodeURIComponent(externalId)}`);
    const json = await this.json(response, "match details");
    if (!json.match || Number(json.match.id) !== externalId) throw new Error("FAF EMS match details do not match the requested match.");
    return json;
  }

  /** Fetch a club crest with the EMS session when it remains on the FAF origin.
   * EMS image endpoints may require the same cookie as the match API. Redirects
   * are followed manually so credentials are never sent to another host. */
  async opponentLogo(rawUrl: string): Promise<Response> {
    const config = getFAFConfig();
    let current = new URL(rawUrl, config.portalUrl);
    const portalOrigin = new URL(config.portalUrl).origin;
    const visited = new Set<string>();
    let cookie: string | null = null;

    for (let redirects = 0; redirects <= 4; redirects++) {
      if (current.protocol !== "https:" || !isSafeExternalUrl(current.href) || visited.has(current.href)) {
        throw new Error("Unsafe or repeated FAF EMS opponent logo URL.");
      }
      visited.add(current.href);
      const sameOrigin = current.origin === portalOrigin;
      if (sameOrigin && !cookie) cookie = await this.cookie();
      const response = await this.fetchRemote(current.href, {
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
          "User-Agent": config.userAgent,
          Referer: `${config.portalUrl}/`,
          ...(sameOrigin && cookie ? { Cookie: cookie } : {})
        },
        signal: AbortSignal.timeout(Math.min(config.timeoutMs, 10000)),
        redirect: "manual"
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects === 4) throw new Error("FAF EMS opponent logo redirect could not be followed safely.");
        current = new URL(location, current);
        continue;
      }
      return response;
    }
    throw new Error("FAF EMS opponent logo has too many redirects.");
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
