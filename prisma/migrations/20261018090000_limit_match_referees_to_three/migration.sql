-- Match crews in this platform consist of the main referee and two assistants.
-- Remove any legacy fourth entry that could have been imported as a player.
UPDATE "Match"
SET "refereeName" = array_to_string((regexp_split_to_array("refereeName", '[[:space:]]*[,،][[:space:]]*'))[1:3], ', ')
WHERE "refereeName" IS NOT NULL
  AND cardinality(regexp_split_to_array("refereeName", '[[:space:]]*[,،][[:space:]]*')) > 3;

UPDATE "Match"
SET "refereeNameAr" = array_to_string((regexp_split_to_array("refereeNameAr", '[[:space:]]*[,،][[:space:]]*'))[1:3], '، ')
WHERE "refereeNameAr" IS NOT NULL
  AND cardinality(regexp_split_to_array("refereeNameAr", '[[:space:]]*[,،][[:space:]]*')) > 3;

UPDATE "Match"
SET "refereeNameFr" = array_to_string((regexp_split_to_array("refereeNameFr", '[[:space:]]*[,،][[:space:]]*'))[1:3], ', ')
WHERE "refereeNameFr" IS NOT NULL
  AND cardinality(regexp_split_to_array("refereeNameFr", '[[:space:]]*[,،][[:space:]]*')) > 3;
