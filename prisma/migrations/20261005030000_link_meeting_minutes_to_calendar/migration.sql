ALTER TABLE "MeetingMinute" ADD COLUMN "calendarEventId" TEXT;

CREATE UNIQUE INDEX "MeetingMinute_calendarEventId_key" ON "MeetingMinute"("calendarEventId");

ALTER TABLE "MeetingMinute"
ADD CONSTRAINT "MeetingMinute_calendarEventId_fkey"
FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill any match and training records that predate automatic calendar sync.
INSERT INTO "CalendarEvent" ("id", "title", "type", "startDateTime", "endDateTime", "location", "teamId", "relatedMatchId", "createdAt")
SELECT 'cal_match_' || m."id", m."homeTeamName" || ' vs ' || m."awayTeamName", 'MATCH', m."matchDate",
       m."matchDate" + INTERVAL '2 hours', m."stadium", m."teamId", m."id", CURRENT_TIMESTAMP
FROM "Match" m
WHERE NOT EXISTS (SELECT 1 FROM "CalendarEvent" e WHERE e."relatedMatchId" = m."id");

INSERT INTO "CalendarEvent" ("id", "title", "type", "startDateTime", "endDateTime", "location", "teamId", "relatedTrainingId", "createdAt")
SELECT 'cal_training_' || t."id", 'Training', 'TRAINING', t."startTime", t."endTime", t."location", t."teamId", t."id", CURRENT_TIMESTAMP
FROM "TrainingSession" t
WHERE NOT EXISTS (SELECT 1 FROM "CalendarEvent" e WHERE e."relatedTrainingId" = t."id");
