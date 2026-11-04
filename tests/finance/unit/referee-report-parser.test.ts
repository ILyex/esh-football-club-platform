import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findBestPlayerMatch,
  parseReportDeterministically,
  type SquadPlayer
} from "@/lib/ai/referee-report-ai-service";

// A small squad standing in for the club roster. Ids are stable so assertions
// can name the exact player the parser is expected to attach an event to.
const squad: SquadPlayer[] = [
  { id: "p1", firstName: "كريم", lastName: "بن علي", firstNameFr: "Karim", lastNameFr: "Benali", shirtNumber: 9 },
  { id: "p2", firstName: "ياسين", lastName: "مرابط", firstNameFr: "Yacine", lastNameFr: "Merabet", shirtNumber: 6 },
  { id: "p3", firstName: "سفيان", lastName: "حمدي", firstNameFr: "Sofiane", lastNameFr: "Hamdi", shirtNumber: 17 }
];

test("referee report parser: extracts a goal with its minute and player", () => {
  const result = parseReportDeterministically("هدف كريم بن علي د 34", squad);
  const goal = result.events.find((event) => event.type === "GOAL");
  assert.ok(goal, "a goal event must be produced");
  assert.equal(goal.playerId, "p1");
  assert.equal(goal.minute, 34);
});

test("referee report parser: extracts a yellow card, never as a goal", () => {
  const result = parseReportDeterministically("بطاقة صفراء للاعب ياسين مرابط د 52", squad);
  assert.equal(result.events.filter((event) => event.type === "GOAL").length, 0);
  const card = result.events.find((event) => event.type === "YELLOW_CARD");
  assert.ok(card, "a yellow card must be produced");
  assert.equal(card.playerId, "p2");
  assert.equal(card.minute, 52);
});

test("referee report parser: links a substitution pair on the same minute", () => {
  const result = parseReportDeterministically("تبديل د 70: دخل سفيان حمدي و خرج كريم بن علي", squad);
  const entering = result.events.find((event) => event.type === "SUBSTITUTION_IN");
  const leaving = result.events.find((event) => event.type === "SUBSTITUTION_OUT");
  assert.ok(entering && leaving, "both sides of the substitution must be produced");
  assert.equal(entering.playerId, "p3");
  assert.equal(leaving.playerId, "p1");
  assert.equal(entering.minute, 70);
  assert.equal(entering.substitutionPairKey, leaving.substitutionPairKey);
});

test("referee report parser: detects the score line", () => {
  const result = parseReportDeterministically("النتيجة النهائية 2 - 1", squad);
  assert.deepEqual(result.detectedScore, { home: 2, away: 1 });
});

test("referee report parser: never invents an event for an unknown name", () => {
  const result = parseReportDeterministically("هدف لاعب مجهول تماما د 12", squad);
  const goal = result.events.find((event) => event.type === "GOAL");
  assert.ok(goal, "the line is still reported");
  assert.equal(goal.playerId, null, "an unmatched name must not be attached to a squad player");
});

test("referee report parser: no minute means no event", () => {
  const result = parseReportDeterministically("هدف كريم بن علي", squad);
  assert.equal(result.events.length, 0, "an untimed line is not a provable event");
});

test("player matcher: fuzzy Arabic name variants resolve to the right player", () => {
  assert.equal(findBestPlayerMatch("بن علي كريم", null, squad)?.id, "p1");
  assert.equal(findBestPlayerMatch("Karim Benali", null, squad)?.id, "p1");
  assert.equal(findBestPlayerMatch("لاعب غير موجود", null, squad), null);
});

// FAF's final report is a layout PDF: extraction emits the whole name column,
// then the minute column. The line-by-line parser sees no event at all, which is
// exactly why imported matches had an empty timeline.
test("referee report parser: pairs a name column with a minute column under a goals heading", () => {
  const text = ["الأهداف", "كريم بن علي", "34"].join("\n");
  const result = parseReportDeterministically(text, squad);
  const goal = result.events.find((event) => event.type === "GOAL");
  assert.ok(goal, "the column layout must still produce the goal");
  assert.equal(goal.playerId, "p1");
  assert.equal(goal.minute, 34);
});

test("referee report parser: uses the substitutions heading for a column-only row", () => {
  const text = ["التغييرات", "سفيان حمدي", "70"].join("\n");
  const result = parseReportDeterministically(text, squad);
  const substitution = result.events.find((event) => event.type === "SUBSTITUTION_IN");
  assert.ok(substitution, "the substitution must be recovered from the section heading");
  assert.equal(substitution.playerId, "p3");
  assert.equal(substitution.minute, 70);
});

test("referee report parser: a cards heading yields a booking, not a goal", () => {
  const text = ["البطاقات", "ياسين مرابط", "52"].join("\n");
  const result = parseReportDeterministically(text, squad);
  assert.equal(result.events.filter((event) => event.type === "GOAL").length, 0);
  const card = result.events.find((event) => event.type === "YELLOW_CARD");
  assert.ok(card);
  assert.equal(card.playerId, "p2");
});
