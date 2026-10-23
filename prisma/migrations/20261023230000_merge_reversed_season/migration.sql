BEGIN;

DO $$
DECLARE
  current_season_id TEXT;
  reversed_season_id TEXT;
BEGIN
  SELECT "id" INTO current_season_id
  FROM "Season"
  WHERE "label" = '2026/2027' AND "isCurrent" = TRUE
  ORDER BY "startDate" DESC
  LIMIT 1;

  SELECT "id" INTO reversed_season_id
  FROM "Season"
  WHERE "label" = '2027/2026'
  LIMIT 1;

  IF reversed_season_id IS NULL THEN
    RAISE NOTICE 'No reversed season 2027/2026 found; nothing to merge.';
    RETURN;
  END IF;

  IF current_season_id IS NULL THEN
    RAISE EXCEPTION 'Cannot remove season 2027/2026 because the current 2026/2027 season is missing.';
  END IF;

  UPDATE "Season"
  SET "isCurrent" = FALSE
  WHERE "isCurrent" = TRUE AND "id" <> current_season_id;

  UPDATE "Competition"
  SET "seasonId" = current_season_id
  WHERE "seasonId" = reversed_season_id;

  UPDATE "Budget"
  SET "seasonId" = current_season_id
  WHERE "seasonId" = reversed_season_id;

  UPDATE "Expense"
  SET "seasonId" = current_season_id
  WHERE "seasonId" = reversed_season_id;

  INSERT INTO "PlayerStatistic" (
    "id", "playerId", "seasonId", "appearances", "goals", "assists",
    "yellowCards", "redCards", "minutesPlayed"
  )
  SELECT
    'season_merge_' || md5(stats."id"), stats."playerId", current_season_id,
    stats."appearances", stats."goals", stats."assists", stats."yellowCards",
    stats."redCards", stats."minutesPlayed"
  FROM "PlayerStatistic" stats
  WHERE stats."seasonId" = reversed_season_id
  ON CONFLICT ("playerId", "seasonId") DO UPDATE SET
    "appearances" = "PlayerStatistic"."appearances" + EXCLUDED."appearances",
    "goals" = "PlayerStatistic"."goals" + EXCLUDED."goals",
    "assists" = "PlayerStatistic"."assists" + EXCLUDED."assists",
    "yellowCards" = "PlayerStatistic"."yellowCards" + EXCLUDED."yellowCards",
    "redCards" = "PlayerStatistic"."redCards" + EXCLUDED."redCards",
    "minutesPlayed" = "PlayerStatistic"."minutesPlayed" + EXCLUDED."minutesPlayed";

  DELETE FROM "PlayerStatistic" WHERE "seasonId" = reversed_season_id;
  DELETE FROM "Season" WHERE "id" = reversed_season_id;
END $$;

COMMIT;
