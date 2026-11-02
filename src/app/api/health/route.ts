import "server-only";

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// PHASE 13 — PRODUCTION HEALTH & READINESS PROBE
// ----------------------------------------------------------------------------
// Provides standardized health endpoints for orchestration platforms
// (Kubernetes, AWS ECS, GCP Cloud Run, Docker Swarm, Fly.io, Railway, systemd).
//
// Endpoints:
//   - GET /api/health                 -> Full health check (database + process)
//   - GET /api/health?type=liveness   -> Lightweight process liveness probe
//   - GET /api/health?type=readiness  -> Dependency readiness probe (PostgreSQL)
//
// Fail-safe boundary: Zero leakage of database credentials, connection strings,
// internal file paths, or raw stack traces.
// ============================================================================

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const probeType = searchParams.get("type") || "full";
  const now = new Date().toISOString();

  // 1. Lightweight Liveness Probe
  if (probeType === "liveness") {
    return NextResponse.json(
      {
        status: "healthy",
        probe: "liveness",
        timestamp: now,
        uptimeSeconds: Math.floor(process.uptime())
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
      }
    );
  }

  // 2. Readiness / Full Health Probe
  let dbStatus = "connected";
  let isHealthy = true;

  try {
    // Quick ping to PostgreSQL with bounded timeout
    // Keep the liveness probe independent of Prisma initialization. On
    // Cloudflare, importing the database adapter into every cold isolate can
    // exceed the Worker CPU budget even when this branch never queries it.
    const { db } = await import("@/lib/db");
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Database ping timeout")), 4000))
    ]);
  } catch {
    dbStatus = "unavailable";
    isHealthy = false;
  }

  const statusCode = isHealthy ? 200 : 503;

  // Environment validation is reported here (Node runtime only) instead of at
  // instrumentation time, where a failure used to break middleware for every
  // request. Problems stay visible to operations without taking the site down.
  let configStatus: "valid" | "invalid" = "valid";
  let configIssues: string[] = [];
  if (probeType === "readiness" || probeType === "full") {
    try {
      const { validateEnvironment } = await import("@/lib/env");
      const config = validateEnvironment();
      configStatus = config.ok ? "valid" : "invalid";
      configIssues = config.issues;
    } catch {
      configStatus = "invalid";
      configIssues = ["environment validation failed to run"];
    }
  }

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      probe: probeType,
      timestamp: now,
      version: "0.1.0",
      services: {
        process: "healthy",
        database: dbStatus
      },
      configuration: {
        status: configStatus,
        issues: configIssues
      }
    },
    {
      status: statusCode,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
    }
  );
}
