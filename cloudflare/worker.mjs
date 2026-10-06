import nextWorker from "../.open-next/worker.js";

/**
 * Adds a native Cloudflare Cron Trigger while leaving all HTTP routing to the
 * OpenNext-generated application worker. The scheduled request reuses the
 * existing secret-protected jobs endpoint and its established batch logic.
 */
export default {
  fetch(request, env, ctx) {
    return nextWorker.fetch(request, env, ctx);
  },

  async scheduled(_controller, env, ctx) {
    if (!env.CRON_SECRET) {
      console.error("CRON_SECRET is not configured; scheduled jobs were skipped.");
      return;
    }

    const response = await nextWorker.fetch(
      new Request("https://internal.invalid/api/cron/process-jobs", {
        method: "POST",
        headers: { authorization: `Bearer ${env.CRON_SECRET}` }
      }),
      env,
      ctx
    );

    if (!response.ok) {
      throw new Error(`Scheduled jobs endpoint failed with HTTP ${response.status}.`);
    }
  }
};
