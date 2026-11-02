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
  // PRODUCTION-SAFE VALIDATION.
  // register() runs in the SAME runtime as middleware, so throwing here turns
  // every request — including /api/health — into MIDDLEWARE_INVOCATION_FAILED.
  // A first version of this check did exactly that on a deployment whose env
  // was missing optional storage variables. The check therefore:
  //   1. never runs in the edge runtime (middleware's runtime),
  //   2. reports problems loudly but does NOT stop the server by default,
  //   3. only fails the boot when ENV_VALIDATION_STRICT=true is set on purpose.
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { validateEnvironment } = await import("@/lib/env");
    const result = validateEnvironment();
    for (const warning of result.warnings) console.warn(`[env] ${warning}`);
    if (result.ok) return;

    const detail = result.issues.map((issue) => ` - ${issue}`).join("\n");
    const strict = process.env.ENV_VALIDATION_STRICT === "true";
    const message = `[env] invalid production configuration${strict ? "" : " (server continues)"}:\n${detail}`;
    if (strict) throw new Error(message);
    console.error(message);
  } catch (error) {
    if (process.env.ENV_VALIDATION_STRICT === "true") throw error;
    console.error("[env] environment validation could not run", error instanceof Error ? error.message : error);
  }
}
