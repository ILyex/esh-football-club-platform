import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maintenanceCleanupSchema,
  registerMaintenanceJobHandler,
  runMaintenanceCleanup
} from "@/lib/maintenance/maintenance-job";
import { hasJobHandler } from "@/lib/jobs/registry";

test("maintenanceCleanupSchema validates default and custom retention parameters", () => {
  const parsedDefault = maintenanceCleanupSchema.parse({});
  assert.equal(parsedDefault.retentionAnalyticsDays, undefined);
  assert.equal(parsedDefault.retentionCompletedJobsDays, undefined);

  const parsedCustom = maintenanceCleanupSchema.parse({
    retentionAnalyticsDays: 60,
    retentionCompletedJobsDays: 15
  });
  assert.equal(parsedCustom.retentionAnalyticsDays, 60);
  assert.equal(parsedCustom.retentionCompletedJobsDays, 15);
});

test("registerMaintenanceJobHandler registers system.maintenance_cleanup idempotently", () => {
  registerMaintenanceJobHandler();
  assert.ok(hasJobHandler("system.maintenance_cleanup"));
  // Calling it again should be a safe no-op
  registerMaintenanceJobHandler();
  assert.ok(hasJobHandler("system.maintenance_cleanup"));
});

test("runMaintenanceCleanup executes cleanly with safe fallback counts", async () => {
  const result = await runMaintenanceCleanup({
    retentionAnalyticsDays: 90,
    retentionCompletedJobsDays: 30
  });

  assert.ok(typeof result.rateLimitBucketsPurged === "number");
  assert.ok(typeof result.analyticsEventsPurged === "number");
  assert.ok(typeof result.backgroundJobsPurged === "number");
});
