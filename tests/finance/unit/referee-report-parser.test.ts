import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findBestPlayerMatch,
  parseReportDeterministically,
  hasExplicitEventEvidence,
  parseEventMinute,
  eventMinuteFromReportLine,
  parseFafReportTables,
  type SquadPlayer
} from "@/lib/ai/referee-report-ai-service";
import {
  extractFinalMatchReportSection,
  isRawDocumentDump
} from "@/lib/matches/referee-report-section";

// A squad standing in for the club roster. Ids are stable so assertions
// can name the exact player the parser is expected to attach an event to.
const squad: SquadPlayer[] = [
  { id: "p1", firstName: "كريم", lastName: "بن علي", firstNameFr: "Karim", lastNameFr: "Benali", shirtNumber: 9 },
  { id: "p2", firstName: "ياسين", lastName: "مرابط", firstNameFr: "Yacine", lastNameFr: "Merabet", shirtNumber: 6 },
  { id: "p3", firstName: "سفيان", lastName: "حمدي", firstNameFr: "Sofiane", lastNameFr: "Hamdi", shirtNumber: 17 },
  { id: "p4", firstName: "محمد", lastName: "عبده", firstNameFr: "Mohamed", lastNameFr: "Abde", shirtNumber: 10 },
  { id: "p5", firstName: "عبد الله", lastName: "قادري", firstNameFr: "Abdallah", lastNameFr: "Kadri", shirtNumber: 8 }
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

test("referee report parser: recognizes Mohamed Abde with Algerian spelling variants (عبدو vs عبده)", () => {
  const result = parseReportDeterministically("هدف محمد عبدو د 34", squad);
  const goal = result.events.find((event) => event.type === "GOAL");
  assert.ok(goal, "goal for Mohamed Abde must be extracted");
  assert.equal(goal.playerId, "p4", "Mohamed Abdou variant must resolve to player Mohamed Abde (p4)");
  assert.equal(goal.minute, 34);
});

test("player matcher: matches compound names (عبد الله vs عبدالله, بن علي vs بنعلي)", () => {
  assert.equal(findBestPlayerMatch("عبدالله قادري", null, squad)?.id, "p5");
  assert.equal(findBestPlayerMatch("عبد الله قادري", null, squad)?.id, "p5");
  assert.equal(findBestPlayerMatch("بنعلي كريم", null, squad)?.id, "p1");
  assert.equal(findBestPlayerMatch("كريم بنعلي", null, squad)?.id, "p1");
});

test("player matcher: matches French transliteration and initials (M. Abde, Mohamed Abde)", () => {
  assert.equal(findBestPlayerMatch("Mohamed Abde", null, squad)?.id, "p4");
  assert.equal(findBestPlayerMatch("M. Abde", null, squad)?.id, "p4");
  assert.equal(findBestPlayerMatch("K. Benali", null, squad)?.id, "p1");
});

test("referee report parser: validates explicit event evidence for matched player", () => {
  const event = {
    playerId: "p4",
    playerName: "محمد عبده",
    shirtNumber: 10,
    type: "GOAL" as const,
    minute: 34
  };
  const text = "تقرير اللقاء\nسجل اللاعب محمد عبدو هدفا رائعا في د 34 من اللقاء";
  assert.ok(hasExplicitEventEvidence(text, event, squad), "event evidence must be confirmed for spelling variant");
});

test("extractFinalMatchReportSection: extracts Algerian narrative headings and strips signatures", () => {
  const textWithArRemarks = [
    "ورقة التحكيم الرسمية",
    "التشكيلة والبطاقات ...",
    "ملاحظات الحكم: جرت المقابلة في ظروف جيدة وبروح رياضية عالية بين الفريقين دون أي حادث.",
    "توقيع الحكم: بوحفص أمين"
  ].join("\n");

  const extracted = extractFinalMatchReportSection(textWithArRemarks);
  assert.ok(extracted, "narrative report section must be extracted");
  assert.equal(extracted, "جرت المقابلة في ظروف جيدة وبروح رياضية عالية بين الفريقين دون أي حادث.");
  assert.ok(!extracted.includes("توقيع الحكم"), "trailing signature must be stripped");
});

test("extractFinalMatchReportSection: rejects raw document dumps without genuine narrative", () => {
  const rawDump = [
    "FAF-EMS FEUILLE DE MATCH OFFICIELLE",
    "Ligue de Football de la Wilaya de Tiaret",
    "Dossard Nom Prénom Licence N°",
    "1 Belkacem Yacine 26-00123",
    "4 Ferhat Karim 26-00456",
    "5 Cherif Nabil 26-00789"
  ].join("\n");

  assert.equal(extractFinalMatchReportSection(rawDump), null, "raw document dump must return null");
  assert.ok(isRawDocumentDump(rawDump), "isRawDocumentDump must recognize document tables");
});

test("referee report parser: handles special match minutes (half-time, full-time, timestamps and bidi marks)", () => {
  assert.equal(parseEventMinute("بين الشوطين"), 45);
  assert.equal(parseEventMinute("mi-temps"), 45);
  assert.equal(parseEventMinute("بعد نهاية المباراة"), 90);
  assert.equal(parseEventMinute("fin du match"), 90);
  assert.equal(parseEventMinute("90+3"), 93);
  assert.equal(parseEventMinute("67:00"), 67);
  assert.equal(parseEventMinute("01:11:00"), 71);
  assert.equal(parseEventMinute("\u200E25'"), 25);
  assert.equal(parseEventMinute("\u200F82'"), 82);
  assert.equal(eventMinuteFromReportLine("\u200E67'"), 67);
  assert.equal(eventMinuteFromReportLine("هدف \u200F67:00"), 67);
});

test("referee report parser: full official FAF-EMS report (ESH vs RBS) with 2-column tables", () => {
  const eshSquad: SquadPlayer[] = [
    { id: "esh-3", firstName: "لحسن", lastName: "عماري", shirtNumber: 3 },
    { id: "esh-12", firstName: "ياسر الدين اسماعيل", lastName: "ذياب", shirtNumber: 12 },
    { id: "esh-17", firstName: "سيف الاسلام وائل", lastName: "عمارة", shirtNumber: 17 },
    { id: "esh-15", firstName: "ابراهيم", lastName: "جلولي", shirtNumber: 15 },
    { id: "esh-34", firstName: "عامر بلقاسم", lastName: "بوخرص", shirtNumber: 34 },
    { id: "esh-19", firstName: "محمد اسلام", lastName: "فرحات", shirtNumber: 19 },
    { id: "esh-11", firstName: "ميلود", lastName: "زرقان", shirtNumber: 11 },
    { id: "esh-10", firstName: "جمال الدين", lastName: "بن صحراوي", shirtNumber: 10 },
    { id: "esh-4", firstName: "محمد صالح", lastName: "عواد", shirtNumber: 4 },
    { id: "esh-41", firstName: "محمد أيوب", lastName: "لعروسي", shirtNumber: 41 },
    { id: "esh-5", firstName: "معتز بالله", lastName: "ساكت", shirtNumber: 5 },
    { id: "esh-9", firstName: "أحمد", lastName: "بومعزة", shirtNumber: 9 }
  ];

  const officialFafReportText = [
    "تقرير المباراة النهائي — نادي أمل سيدي حسني ضد ر.سوقر (RBS)",
    "FAF-EMS-259687-final-report-ar.pdf",
    "",
    "التغييرات",
    "عماري لحسن 3 ذياب ياسر الدين اسماعيل 12 بين الشوطين",
    "عمارة سيف الاسلام وائل 17 جلولي ابراهيم 15 71'",
    "بوخرص عامر بلقاسم 34 عمارة سيف الاسلام وائل 17 90'",
    "فرحات محمد اسلام 19 زرقان ميلود 11 90'",
    "ملياني محمد ياسين 31 محمد بهاء الدين بوهني 20 61'",
    "بن عتو نصرو 22 قرن يوسف 8 81'",
    "",
    "البطاقات",
    "بن صحراوي جمال الدين 10 اللعب الخطير 10'",
    "عواد محمد صالح 4 اللعب الخطير 25'",
    "لعروسي محمد أيوب 41 سلوك غير رياضي 30'",
    "ساكت معتز بالله 5 سلوك غير رياضي 82'",
    "ذياب ياسر الدين اسماعيل 12 اهانة تجاه حكم بعد نهاية المباراة",
    "بلحواس جمال الدين 12 اللعب الخطير 34'",
    "",
    "الاهداف",
    "بومعزة أحمد 9 هدف 67'",
    "عامر أسامة 24 هدف 20'",
    "بغداد كمال 9 هدف 78'",
    "",
    "تقرير المباراة",
    "R.A.S"
  ].join("\n");

  const result = parseReportDeterministically(officialFafReportText, eshSquad, { clubIsHome: true });

  // 1. Verify goals
  const goals = result.events.filter((e) => e.type === "GOAL");
  assert.equal(goals.length, 3, "should extract 3 goals");
  const eshGoal = goals.find((g) => g.playerId === "esh-9");
  assert.ok(eshGoal, "ESH goal by Boumaza Ahmed must be linked to squad");
  assert.equal(eshGoal.minute, 67);
  assert.equal(eshGoal.side, "HOME");

  const rbsGoal1 = goals.find((g) => g.playerName.includes("عامر أسامة"));
  assert.ok(rbsGoal1, "RBS goal by Amer Oussama must be extracted");
  assert.equal(rbsGoal1.minute, 20);
  assert.equal(rbsGoal1.playerId, null, "Opponent goal should have playerId: null");
  assert.equal(rbsGoal1.side, "AWAY");

  const rbsGoal2 = goals.find((g) => g.playerName.includes("بغداد كمال"));
  assert.ok(rbsGoal2, "RBS goal by Baghdad Kamal must be extracted");
  assert.equal(rbsGoal2.minute, 78);
  assert.equal(rbsGoal2.playerId, null);
  assert.equal(rbsGoal2.side, "AWAY");

  // 2. Verify score
  assert.deepEqual(result.detectedScore, { home: 1, away: 2 });

  // 3. Verify cards
  const cards = result.events.filter((e) => e.type === "YELLOW_CARD" || e.type === "RED_CARD");
  assert.equal(cards.length, 6, "should extract 6 cards total");

  const redCard = cards.find((c) => c.type === "RED_CARD");
  assert.ok(redCard, "Direct red card for referee insult must be recognized");
  assert.equal(redCard.playerId, "esh-12");
  assert.equal(redCard.minute, 90);

  const opponentCard = cards.find((c) => c.playerName.includes("بلحواس جمال الدين"));
  assert.ok(opponentCard, "Opponent yellow card must be extracted");
  assert.equal(opponentCard.playerId, null);
  assert.equal(opponentCard.side, "AWAY");
  assert.equal(opponentCard.minute, 34);

  // 4. Verify substitutions
  const subsIn = result.events.filter((e) => e.type === "SUBSTITUTION_IN");
  const subsOut = result.events.filter((e) => e.type === "SUBSTITUTION_OUT");
  assert.equal(subsIn.length, 6, "should extract 6 incoming substitutions");
  assert.equal(subsOut.length, 6, "should extract 6 outgoing substitutions");

  const htSubIn = subsIn.find((s) => s.playerId === "esh-3");
  const htSubOut = subsOut.find((s) => s.playerId === "esh-12");
  assert.ok(htSubIn && htSubOut, "Half-time substitution must be extracted and paired");
  assert.equal(htSubIn.minute, 45);
  assert.equal(htSubOut.minute, 45);
  assert.equal(htSubIn.substitutionPairKey, htSubOut.substitutionPairKey);

  // 5. Verify narrative report extraction
  assert.equal(extractFinalMatchReportSection(officialFafReportText), "R.A.S");

  // 6. Verify hasExplicitEventEvidence passes for all extracted events
  for (const event of result.events) {
    assert.ok(
      hasExplicitEventEvidence(officialFafReportText, event, eshSquad),
      `Event ${event.type} for ${event.playerName} at minute ${event.minute} must have explicit evidence`
    );
  }
});

test("referee report parser: real multiline PDF layout (names, cards, minutes on separate lines)", () => {
  const eshSquad: SquadPlayer[] = [
    { id: "esh-3", firstName: "لحسن", lastName: "عماري", shirtNumber: 3 },
    { id: "esh-12", firstName: "ياسر الدين اسماعيل", lastName: "ذياب", shirtNumber: 12 },
    { id: "esh-17", firstName: "سيف الاسلام وائل", lastName: "عمارة", shirtNumber: 17 },
    { id: "esh-15", firstName: "ابراهيم", lastName: "جلولي", shirtNumber: 15 },
    { id: "esh-34", firstName: "عامر بلقاسم", lastName: "بوخرص", shirtNumber: 34 },
    { id: "esh-19", firstName: "محمد اسلام", lastName: "فرحات", shirtNumber: 19 },
    { id: "esh-11", firstName: "ميلود", lastName: "زرقان", shirtNumber: 11 },
    { id: "esh-10", firstName: "جمال الدين", lastName: "بن صحراوي", shirtNumber: 10 },
    { id: "esh-4", firstName: "محمد صالح", lastName: "عواد", shirtNumber: 4 },
    { id: "esh-41", firstName: "محمد أيوب", lastName: "لعروسي", shirtNumber: 41 },
    { id: "esh-5", firstName: "معتز بالله", lastName: "ساكت", shirtNumber: 5 },
    { id: "esh-9", firstName: "أحمد", lastName: "بومعزة", shirtNumber: 9 }
  ];

  const multilineFafReportText = [
    "تقرير المباراة النهائي",
    "FAF-EMS-259687-final-report-ar.pdf",
    "",
    "التغييرات",
    "عماري لحسن 3",
    "ذياب ياسر الدين اسماعيل 12",
    "بين الشوطين",
    "عمارة سيف الاسلام وائل 17",
    "جلولي ابراهيم 15",
    "71'",
    "بوخرص عامر بلقاسم 34",
    "عمارة سيف الاسلام وائل 17",
    "90'",
    "فرحات محمد اسلام 19",
    "زرقان ميلود 11",
    "90'",
    "ملياني محمد ياسين 31",
    "محمد بهاء الدين بوهني 20",
    "61'",
    "بن عتو نصرو 22",
    "قرن يوسف 8",
    "81'",
    "",
    "البطاقات",
    "بن صحراوي جمال الدين 10",
    "اللعب الخطير",
    "10'",
    "عواد محمد صالح 4",
    "اللعب الخطير",
    "25'",
    "لعروسي محمد أيوب 41",
    "سلوك غير رياضي",
    "30'",
    "ساكت معتز بالله 5",
    "سلوك غير رياضي",
    "82'",
    "ذياب ياسر الدين اسماعيل 12",
    "اهانة تجاه حكم",
    "بعد نهاية المباراة",
    "بلحواس جمال الدين 12",
    "اللعب الخطير",
    "34'",
    "",
    "الاهداف",
    "بومعزة أحمد 9",
    "هدف",
    "67'",
    "عامر أسامة 24",
    "هدف",
    "20'",
    "بغداد كمال 9",
    "هدف",
    "78'",
    "",
    "تقرير المباراة",
    "R.A.S"
  ].join("\n");

  const result = parseReportDeterministically(multilineFafReportText, eshSquad, { clubIsHome: true });
  const goals = result.events.filter((e) => e.type === "GOAL");
  assert.equal(goals.length, 3, `Expected 3 goals, got ${goals.length}: ${JSON.stringify(goals)}`);
  assert.equal(result.events.filter((e) => e.type === "YELLOW_CARD" || e.type === "RED_CARD").length, 6, "should extract 6 cards from multiline text");
  assert.equal(result.events.filter((e) => e.type === "SUBSTITUTION_IN").length, 6, "should extract 6 substitutions from multiline text");

  for (const event of result.events) {
    assert.ok(
      hasExplicitEventEvidence(multilineFafReportText, event, eshSquad),
      `Event ${event.type} for ${event.playerName} at minute ${event.minute} must have explicit evidence in multiline report`
    );
  }
});

test("referee report parser: handles text with invisible Bidi markers (\u200E, \u200F)", () => {
  const eshSquad: SquadPlayer[] = [
    { id: "esh-9", firstName: "أحمد", lastName: "بومعزة", shirtNumber: 9 },
    { id: "esh-10", firstName: "جمال الدين", lastName: "بن صحراوي", shirtNumber: 10 }
  ];

  const bidiReportText = [
    "\u200Eتقرير المباراة النهائي — نادي أمل سيدي حسني ضد ر.سوقر (RBS)",
    "\u200Fالبطاقات",
    "\u200Eبن صحراوي جمال الدين 10 اللعب الخطير \u200E10'",
    "",
    "\u200Fالاهداف",
    "\u200Eبومعزة أحمد 9 هدف \u200F67'"
  ].join("\n");

  const result = parseReportDeterministically(bidiReportText, eshSquad, { clubIsHome: true });
  assert.equal(result.events.length, 2, "must extract both events even with Bidi markers");
  const goal = result.events.find((e) => e.type === "GOAL");
  assert.ok(goal, "Goal must be extracted");
  assert.equal(goal.minute, 67);
  const card = result.events.find((e) => e.type === "YELLOW_CARD");
  assert.ok(card, "Card must be extracted");
  assert.equal(card.minute, 10);
});
