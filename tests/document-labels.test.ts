import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getDocumentTypeLabel } from "@/lib/documents/labels";

const TEMPLATE_TYPES = [
  "MATCH_REPORT",
  "MEETING_MINUTES",
  "CORRESPONDENCE",
  "ANNOUNCEMENT",
  "PLAYER_REPORT",
  "TRAINING_REPORT",
  "ADMINISTRATIVE_REPORT",
  "EXPENSE_STATEMENT",
  "DEPOSIT_RECEIPT",
  "WITHDRAWAL_RECEIPT",
  "OTHER"
] as const;

describe("Document Type Labels Localization", () => {
  for (const locale of ["ar", "fr"] as const) {
    for (const type of TEMPLATE_TYPES) {
      test(`returns localized label for ${type} in ${locale}`, async () => {
        const label = await getDocumentTypeLabel(type, locale);
        assert.ok(typeof label === "string" && label.length > 0, `Expected label for ${type} in ${locale}`);
        assert.notEqual(label, `types.${type}`, `Should not return raw translation key for ${type}`);
        assert.notEqual(label, type, `Should not return raw enum for ${type}`);
      });
    }

    test(`handles UNKNOWN fallback gracefully in ${locale}`, async () => {
      const label = await getDocumentTypeLabel("NON_EXISTENT_TYPE" as any, locale);
      assert.ok(typeof label === "string" && label.length > 0, `Expected fallback for unknown type in ${locale}`);
    });
  }
});
