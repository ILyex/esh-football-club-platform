-- Existing match lineup positions were copied from player profiles and could
-- become stale when a player's position changed later. Align those snapshots
-- with the current platform roster; future match-specific role edits remain
-- stored on MatchLineup.
UPDATE "MatchLineup" AS lineup
SET "position" = player."position"
FROM "Player" AS player
WHERE lineup."playerId" = player."id"
  AND lineup."position" IS DISTINCT FROM player."position"::text;
