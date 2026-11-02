type DenoCronRuntime = {
  cron?: (
    name: string,
    schedule: string,
    options: { backoffSchedule: number[] },
    handler: () => Promise<void>
  ) => void;
};

const denoRuntime = (globalThis as typeof globalThis & { Deno?: DenoCronRuntime }).Deno;

// Deno Deploy discovers cron jobs by evaluating top-level Deno.cron() calls;
// wrapping the registration in an `if` makes the platform miss the job.
// Keep the registration unconditional, but make it a no-op until cutover so
// the existing Cloudflare scheduler remains the only active job runner.
denoRuntime?.cron?.(
  "esh-process-jobs",
  "* * * * *",
  { backoffSchedule: [5_000, 15_000, 30_000] },
  async () => {
    if (process.env.DENO_CRON_ENABLED !== "true") return;
    const origin = process.env.DENO_CRON_ORIGIN;
    const secret = process.env.CRON_SECRET;
    if (!origin || !secret) throw new Error("Deno cron origin or secret is not configured.");
    const url = new URL("/api/cron/process-jobs", origin);
    if (url.protocol !== "https:") throw new Error("Deno cron origin must use HTTPS.");
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      redirect: "error"
    });
    if (!response.ok) throw new Error(`Deno scheduled jobs endpoint failed with HTTP ${response.status}.`);
  }
);

export async function register() {
  // The cron definition above is registered at module initialization so Deno
  // Deploy can discover it in the Next.js runtime module graph.
  //
  // Fail-fast environment validation. It existed but was never called, so a
  // production deployment with a placeholder AUTH_SECRET or a missing
  // CRON_SECRET started happily. Warnings are always logged; hard issues stop
  // the boot unless ENV_VALIDATION_WARN_ONLY=true is set for a temporary
  // migration window.
  try {
    const { validateEnvironment, assertProductionEnvironment } = await import("@/lib/env");
    const result = validateEnvironment();
    for (const warning of result.warnings) console.warn(`[env] ${warning}`);
    if (!result.ok) {
      const detail = result.issues.map((issue) => ` - ${issue}`).join("\n");
      if (process.env.ENV_VALIDATION_WARN_ONLY === "true") {
        console.error(`[env] INVALID PRODUCTION CONFIGURATION (warn-only mode):\n${detail}`);
      } else {
        assertProductionEnvironment();
      }
    }
  } catch (error) {
    if (process.env.ENV_VALIDATION_WARN_ONLY === "true") {
      console.error("[env] environment validation failed", error instanceof Error ? error.message : error);
      return;
    }
    throw error;
  }
}
