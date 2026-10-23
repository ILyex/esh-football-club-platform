-- Remove per-category insurance checks and statuses. Keep the associated Document rows.
DELETE FROM "BackgroundJob" WHERE "type" = 'team.insurance_check';
DROP TABLE IF EXISTS "TeamInsurancePolicy";
DROP TYPE IF EXISTS "TeamInsuranceCheckStatus";
