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
  },

  async queue(batch, env, _ctx) {
    if (!env.CRON_SECRET) {
      batch.retryAll({ delaySeconds: 60 });
      return;
    }

    for (const message of batch.messages) {
      try {
        const response = await nextWorker.fetch(
          new Request("https://internal.invalid/api/internal/push/process", {
            method: "POST",
            headers: {
              authorization: `Bearer ${env.CRON_SECRET}`,
              "content-type": "application/json"
            },
            body: JSON.stringify(message.body)
          }),
          env,
          _ctx
        );
        if (!response.ok) {
          message.retry({ delaySeconds: Math.min(300, 10 * message.attempts) });
        } else {
          message.ack();
        }
      } catch (error) {
        console.error("[MatchPush] Internal queue dispatch failed.", error);
        message.retry({ delaySeconds: Math.min(300, 10 * message.attempts) });
      }
    }
  }
};
