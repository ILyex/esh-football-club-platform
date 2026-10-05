CREATE TYPE "MatchDocumentType" AS ENUM ('PRE_MATCH_SHEET', 'REFEREE_REPORT');

ALTER TABLE "Document"
ADD COLUMN "matchDocumentType" "MatchDocumentType";

CREATE INDEX "Document_relatedMatchId_matchDocumentType_idx"
ON "Document"("relatedMatchId", "matchDocumentType");
