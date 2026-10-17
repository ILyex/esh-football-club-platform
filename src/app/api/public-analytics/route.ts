import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "esh_analytics_id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCALE_PREFIX = /^\/(ar|fr)(?=\/|$)/i;

function cleanPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512 || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.includes("\\")) return null;
  const rawPath = value.split(/[?#]/, 1)[0];
  if (!rawPath) return null;
  const path = rawPath.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return path.replace(LOCALE_PREFIX, "") || "/";
}

function deviceFrom(userAgent: string): string {
  if (/bot|crawler|spider|slurp|headless|lighthouse|preview/i.test(userAgent)) return "BOT";
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return "TABLET";
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return "MOBILE";
  return "DESKTOP";
}

function sourceFrom(request: NextRequest, candidate?: unknown): string {
  const raw = typeof candidate === "string" && candidate.length <= 2048
    ? candidate
    : request.headers.get("referer");
  if (!raw) return "Direct";
  try {
    const parsed = new URL(raw);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) return "Unknown";
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === request.nextUrl.hostname.toLowerCase()) return "Internal";
    return host.slice(0, 120);
  } catch {
    return "Unknown";
  }
}

export async function POST(request: NextRequest) {
  // Preview deployments and local development can share the production
  // database; never mix their traffic into the live-site reporting tables.
  if (process.env.VERCEL_ENV !== "production") return new NextResponse(null, { status: 204 });

  let payload: unknown;
  try {
    if (Number(request.headers.get("content-length") || 0) > 2048) {
      return new NextResponse(null, { status: 413 });
    }
    payload = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (!payload || typeof payload !== "object") return new NextResponse(null, { status: 400 });
  const data = payload as { type?: unknown; path?: unknown; targetPath?: unknown; referrer?: unknown };
  const path = cleanPath(data.path);
  const targetPath = data.type === "CLICK" ? cleanPath(data.targetPath) : null;
  if ((data.type !== "PAGE_VIEW" && data.type !== "CLICK") || !path || (data.type === "CLICK" && !targetPath)) {
    return new NextResponse(null, { status: 400 });
  }

  const device = deviceFrom(request.headers.get("user-agent") || "");
  if (device === "BOT") return new NextResponse(null, { status: 204 });

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const visitorId = cookieValue && UUID_PATTERN.test(cookieValue) ? cookieValue : randomUUID();
  const visitorKey = createHash("sha256").update(visitorId).digest("hex");
  try {
    await db.websiteAnalyticsEvent.create({
      data: {
        type: data.type,
        path,
        targetPath,
        visitorKey,
        device,
        source: data.type === "PAGE_VIEW" ? sourceFrom(request, data.referrer) : "Internal",
        deploymentEnvironment: "production"
      }
    });
  } catch {
    // A telemetry outage must not interfere with public-site navigation.
    return new NextResponse(null, { status: 204 });
  }

  const response = new NextResponse(null, { status: 204 });
  if (visitorId !== cookieValue) {
    response.cookies.set(COOKIE_NAME, visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90
    });
  }
  return response;
}
