import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectPlayers,
  detectOfficialCaptain,
  detectOfficialShirtNumbers,
  resolvePlayerSelections,
  type SheetPlayer,
  type PlayerEventSummary
} from "@/lib/matches/lineup-from-sheet";

const squad: SheetPlayer[] = [
  { id: "p1", firstName: "لحسن", lastName: "عماري", firstNameFr: "Lahcen", lastNameFr: "Ammari", shirtNumber: 3, licenceNumber: "950101001", position: "DEFENDER", status: "ACTIVE" },
  { id: "p2", firstName: "ياسر الدين اسماعيل", lastName: "ذياب", firstNameFr: "Yasser Eddine Ismail", lastNameFr: "Dhiab", shirtNumber: 12, licenceNumber: "980202002", position: "MIDFIELDER", status: "ACTIVE" },
  { id: "p3", firstName: "سيف الاسلام وائل", lastName: "عمارة", firstNameFr: "Saif El Islam Wael", lastNameFr: "Amara", shirtNumber: 17, licenceNumber: "990303003", position: "FORWARD", status: "ACTIVE" },
  { id: "p4", firstName: "ابراهيم", lastName: "جلولي", firstNameFr: "Brahim", lastNameFr: "Djellouli", shirtNumber: 15, licenceNumber: "970404004", position: "DEFENDER", status: "ACTIVE" },
  { id: "p5", firstName: "عامر بلقاسم", lastName: "بوخرص", firstNameFr: "Amer Belkacem", lastNameFr: "Boukhras", shirtNumber: 34, licenceNumber: "960505005", position: "MIDFIELDER", status: "ACTIVE" },
  { id: "p6", firstName: "محمد اسلام", lastName: "فرحات", firstNameFr: "Mohamed Islam", lastNameFr: "Farhat", shirtNumber: 19, licenceNumber: "980606006", position: "FORWARD", status: "ACTIVE" },
  { id: "p7", firstName: "ميلود", lastName: "زرقان", firstNameFr: "Miloud", lastNameFr: "Zergane", shirtNumber: 11, licenceNumber: "940707007", position: "MIDFIELDER", status: "ACTIVE" },
  { id: "p8", firstName: "جمال الدين", lastName: "بن صحراوي", firstNameFr: "Djamel Eddine", lastNameFr: "Ben Sahraoui", shirtNumber: 10, licenceNumber: "950808008", position: "MIDFIELDER", status: "ACTIVE" },
  { id: "p9", firstName: "محمد صالح", lastName: "عواد", firstNameFr: "Mohamed Salah", lastNameFr: "Aouad", shirtNumber: 4, licenceNumber: "960909009", position: "DEFENDER", status: "ACTIVE" },
  { id: "p10", firstName: "محمد أيوب", lastName: "لعروسي", firstNameFr: "Mohamed Ayoub", lastNameFr: "Laaroussi", shirtNumber: 41, licenceNumber: "991010010", position: "GOALKEEPER", status: "ACTIVE" },
  { id: "p11", firstName: "معتز بالله", lastName: "ساكت", firstNameFr: "Moataz Bellah", lastNameFr: "Saket", shirtNumber: 5, licenceNumber: "971111011", position: "DEFENDER", status: "ACTIVE" },
  { id: "p12", firstName: "أحمد", lastName: "بومعزة", firstNameFr: "Ahmed", lastNameFr: "Boumaaza", shirtNumber: 9, licenceNumber: "961212012", position: "FORWARD", status: "ACTIVE" }
];

test("lineup parser: categorizes starting players and substitutes cleanly", () => {
  const sheetText = `
وثيقة بداية المباراة
نادي أمل سيدي حسني
اللاعبون الأساسيون
10 بن صحراوي جمال الدين (C)
4 عواد محمد صالح
41 لعروسي محمد أيوب
5 ساكت معتز بالله
9 بومعزة أحمد
3 عماري لحسن
12 ذياب ياسر الدين اسماعيل
اللاعبون الاحتياطيون
17 عمارة سيف الاسلام وائل
15 جلولي ابراهيم
34 بوخرص عامر بلقاسم
19 فرحات محمد اسلام
11 زرقان ميلود
طاقم التحكيم
  `;

  const detected = detectPlayers(sheetText, squad);
  assert.equal(detected.hasStarterSection, true);
  assert.equal(detected.hasBenchSection, true);

  // Starters
  assert.equal(detected.players.get("p8"), "STARTING");
  assert.equal(detected.players.get("p9"), "STARTING");
  assert.equal(detected.players.get("p10"), "STARTING");
  assert.equal(detected.players.get("p11"), "STARTING");
  assert.equal(detected.players.get("p12"), "STARTING");
  assert.equal(detected.players.get("p1"), "STARTING");
  assert.equal(detected.players.get("p2"), "STARTING");

  // Substitutes
  assert.equal(detected.players.get("p3"), "SUBSTITUTE");
  assert.equal(detected.players.get("p4"), "SUBSTITUTE");
  assert.equal(detected.players.get("p5"), "SUBSTITUTE");
  assert.equal(detected.players.get("p6"), "SUBSTITUTE");
  assert.equal(detected.players.get("p7"), "SUBSTITUTE");
});

test("lineup parser: detects official captain and shirt numbers", () => {
  const sheetText = `
اللاعبون الأساسيون
10 بن صحراوي جمال الدين (C)
4 عواد محمد صالح
  `;
  const captainId = detectOfficialCaptain(sheetText, squad);
  assert.equal(captainId, "p8");

  const numbers = detectOfficialShirtNumbers(sheetText, squad);
  assert.equal(numbers.get("p8"), 10);
  assert.equal(numbers.get("p9"), 4);
});

test("lineup parser: detects Arabic captain marker (ق) or قائد", () => {
  const sheetText = `
اللاعبون الأساسيون
10 بن صحراوي جمال الدين (ق)
  `;
  assert.equal(detectOfficialCaptain(sheetText, squad), "p8");

  const sheetText2 = `
اللاعبون الأساسيون
10 بن صحراوي جمال الدين قائد
  `;
  assert.equal(detectOfficialCaptain(sheetText2, squad), "p8");
});

test("lineup parser: page 2 substitution events do not overwrite or delete starting players", () => {
  const fullDocumentText = `
وثيقة بداية المباراة
اللاعبون الأساسيون
3 عماري لحسن
12 ذياب ياسر الدين اسماعيل
اللاعبون الاحتياطيون
17 عمارة سيف الاسلام وائل
15 جلولي ابراهيم
طاقم التحكيم
حكم الساحة: فلان

التغييرات
3 عماري لحسن 3 د بين الشوطين ذياب ياسر الدين اسماعيل 12
تبديل د 71: دخول 17 عمارة سيف الاسلام وخروج 15 جلولي ابراهيم
البطاقات
10 بن صحراوي جمال الدين
الأهداف
9 بومعزة أحمد 67
تقرير المباراة
R.A.S
  `;

  const detected = detectPlayers(fullDocumentText, squad);
  // Starting players who were substituted off during match events (page 2)
  // must REMAIN classified as STARTING, not deleted or converted to SUBSTITUTE.
  assert.equal(detected.players.get("p1"), "STARTING");
  assert.equal(detected.players.get("p2"), "STARTING");
  assert.equal(detected.players.get("p3"), "SUBSTITUTE");
  assert.equal(detected.players.get("p4"), "SUBSTITUTE");
});

test("lineup parser: recognizes players with omitted middle names and compound prefixes", () => {
  const { playerMatchesLine } = require("@/lib/matches/lineup-from-sheet");

  // Middle name "وائل" omitted on sheet
  assert.equal(playerMatchesLine("17 عمارة سيف الاسلام", squad.find((p) => p.id === "p3")!), true);

  // Middle name "اسماعيل" omitted on sheet
  assert.equal(playerMatchesLine("12 ذياب ياسر الدين", squad.find((p) => p.id === "p2")!), true);

  // Compound prefix without space: بنصحراوي vs بن صحراوي
  assert.equal(playerMatchesLine("10 بنصحراوي جمال الدين", squad.find((p) => p.id === "p8")!), true);

  // Compound prefix with space: بو خرص vs بوخرص
  assert.equal(playerMatchesLine("34 بو خرص عامر بلقاسم", squad.find((p) => p.id === "p5")!), true);
});

test("lineup parser: recognizes Algerian and French bench section headers", () => {
  const variations = [
    "قائمة الاحتياط",
    "الاحتياطيين",
    "قائمة البدلاء",
    "بدلاء",
    "المعوضين",
    "Remplaçants"
  ];

  for (const header of variations) {
    const text = `
اللاعبون الأساسيون
10 بن صحراوي جمال الدين
4 عواد محمد صالح
${header}
17 عمارة سيف الاسلام وائل
15 جلولي ابراهيم
    `;
    const detected = detectPlayers(text, squad);
    assert.equal(detected.hasStarterSection, true, `Should detect starters with header: ${header}`);
    assert.equal(detected.hasBenchSection, true, `Should detect bench with header: ${header}`);
    assert.equal(detected.players.get("p8"), "STARTING");
    assert.equal(detected.players.get("p3"), "SUBSTITUTE");
  }
});

test("resolvePlayerSelections: correctly distinguishes starters from substitutes based on in-match events", () => {
  const fullSquad: SheetPlayer[] = [
    { id: "esh-1", firstName: "أيوب", lastName: "بدوي", firstNameFr: "Ayoub", lastNameFr: "Badaoui", shirtNumber: 1, licenceNumber: "950101", position: "GOALKEEPER", status: "ACTIVE" },
    { id: "esh-2", firstName: "إلياس", lastName: "صقلي", firstNameFr: "Ilyes", lastNameFr: "Sakli", shirtNumber: 14, licenceNumber: "950102", position: "DEFENDER", status: "ACTIVE" },
    { id: "esh-6", firstName: "إلياس", lastName: "طاهري", firstNameFr: "Ilyes", lastNameFr: "Taheri", shirtNumber: 20, licenceNumber: "950103", position: "MIDFIELDER", status: "ACTIVE" },
    { id: "esh-3", firstName: "لحسن", lastName: "عماري", firstNameFr: "Lahcen", lastNameFr: "Ammari", shirtNumber: 3, licenceNumber: "950104", position: "MIDFIELDER", status: "ACTIVE" },
    { id: "esh-12", firstName: "ياسر الدين اسماعيل", lastName: "ذياب", firstNameFr: "Yasser Eddine Ismail", lastNameFr: "Dhiab", shirtNumber: 12, licenceNumber: "950105", position: "DEFENDER", status: "ACTIVE" },
    { id: "esh-17", firstName: "سيف الاسلام وائل", lastName: "عمارة", firstNameFr: "Saif El Islam Wael", lastNameFr: "Amara", shirtNumber: 17, licenceNumber: "950106", position: "FORWARD", status: "ACTIVE" },
    { id: "esh-15", firstName: "ابراهيم", lastName: "جلولي", firstNameFr: "Brahim", lastNameFr: "Djellouli", shirtNumber: 15, licenceNumber: "950107", position: "MIDFIELDER", status: "ACTIVE" },
    { id: "esh-34", firstName: "عامر بلقاسم", lastName: "بوخرص", firstNameFr: "Amer Belkacem", lastNameFr: "Boukhras", shirtNumber: 34, licenceNumber: "950108", position: "FORWARD", status: "ACTIVE" },
    { id: "esh-19", firstName: "محمد اسلام", lastName: "فرحات", firstNameFr: "Mohamed Islam", lastNameFr: "Farhat", shirtNumber: 19, licenceNumber: "950109", position: "MIDFIELDER", status: "ACTIVE" },
    { id: "esh-11", firstName: "ميلود", lastName: "زرقان", firstNameFr: "Miloud", lastNameFr: "Zergane", shirtNumber: 11, licenceNumber: "950110", position: "MIDFIELDER", status: "ACTIVE" },
    { id: "esh-10", firstName: "جمال الدين", lastName: "بن صحراوي", firstNameFr: "Djamel Eddine", lastNameFr: "Ben Sahraoui", shirtNumber: 10, licenceNumber: "950111", position: "MIDFIELDER", status: "ACTIVE" },
    { id: "esh-4", firstName: "محمد صالح", lastName: "عواد", firstNameFr: "Mohamed Salah", lastNameFr: "Aouad", shirtNumber: 4, licenceNumber: "950112", position: "DEFENDER", status: "ACTIVE" },
    { id: "esh-41", firstName: "محمد أيوب", lastName: "لعروسي", firstNameFr: "Mohamed Ayoub", lastNameFr: "Laaroussi", shirtNumber: 41, licenceNumber: "950113", position: "MIDFIELDER", status: "ACTIVE" },
    { id: "esh-5", firstName: "معتز بالله", lastName: "ساكت", firstNameFr: "Moataz Bellah", lastNameFr: "Saket", shirtNumber: 5, licenceNumber: "950114", position: "DEFENDER", status: "ACTIVE" },
    { id: "esh-9", firstName: "أحمد", lastName: "بومعزة", firstNameFr: "Ahmed", lastNameFr: "Boumaaza", shirtNumber: 9, licenceNumber: "950115", position: "FORWARD", status: "ACTIVE" }
  ];

  // Simulated raw sheet where names were initially read as starting candidates
  const detected = {
    players: new Map<string, "STARTING" | "SUBSTITUTE" | "NOT_CALLED">([
      ["esh-1", "STARTING"],
      ["esh-2", "STARTING"],
      ["esh-6", "STARTING"],
      ["esh-3", "STARTING"],
      ["esh-17", "STARTING"],
      ["esh-34", "STARTING"],
      ["esh-19", "STARTING"],
      ["esh-10", "STARTING"],
      ["esh-4", "STARTING"],
      ["esh-41", "STARTING"],
      ["esh-5", "STARTING"],
      ["esh-9", "STARTING"]
    ]),
    hasStarterSection: true,
    hasBenchSection: false,
    hasExplicitNotCalledSection: false,
    warnings: []
  };

  // Match events from the FAF EMS report:
  const events: PlayerEventSummary[] = [
    // Half-time: Ammari in, Dhiab out
    { type: "SUBSTITUTION_IN", playerId: "esh-3", minute: 45 },
    { type: "SUBSTITUTION_OUT", playerId: "esh-12", minute: 45 },
    // 71': Amara in, Djellouli out
    { type: "SUBSTITUTION_IN", playerId: "esh-17", minute: 71 },
    { type: "SUBSTITUTION_OUT", playerId: "esh-15", minute: 71 },
    // 90': Boukhras in, Amara out (Amara was subbed in earlier!)
    { type: "SUBSTITUTION_IN", playerId: "esh-34", minute: 90 },
    { type: "SUBSTITUTION_OUT", playerId: "esh-17", minute: 90 },
    // 90': Farhat in, Zergane out
    { type: "SUBSTITUTION_IN", playerId: "esh-19", minute: 90 },
    { type: "SUBSTITUTION_OUT", playerId: "esh-11", minute: 90 },
    // Cards:
    { type: "YELLOW_CARD", playerId: "esh-10", minute: 10 },
    { type: "YELLOW_CARD", playerId: "esh-4", minute: 25 },
    { type: "YELLOW_CARD", playerId: "esh-41", minute: 30 },
    { type: "YELLOW_CARD", playerId: "esh-5", minute: 82 },
    { type: "RED_CARD", playerId: "esh-12", minute: 90 },
    // Goal:
    { type: "GOAL", playerId: "esh-9", minute: 67 }
  ];

  const resolved = resolvePlayerSelections({
    detected,
    players: fullSquad,
    events,
    officialCaptainId: "esh-10"
  });

  // 1. Starters must be exactly 11 players
  assert.equal(resolved.starterCount, 11, "Must have exactly 11 starters");

  // 2. Verified starters from match events must be in STARTING:
  assert.equal(resolved.players.get("esh-10"), "STARTING", "Ben Sahraoui (card 10') must be STARTING");
  assert.equal(resolved.players.get("esh-4"), "STARTING", "Aouad (card 25') must be STARTING");
  assert.equal(resolved.players.get("esh-41"), "STARTING", "Laaroussi (card 30') must be STARTING");
  assert.equal(resolved.players.get("esh-9"), "STARTING", "Boumaza (goal 67') must be STARTING");
  assert.equal(resolved.players.get("esh-5"), "STARTING", "Saket (card 82') must be STARTING");
  assert.equal(resolved.players.get("esh-12"), "STARTING", "Dhiab (subbed out HT) must be STARTING");
  assert.equal(resolved.players.get("esh-15"), "STARTING", "Djellouli (subbed out 71') must be STARTING");
  assert.equal(resolved.players.get("esh-11"), "STARTING", "Zergane (subbed out 90') must be STARTING");
  assert.equal(resolved.players.get("esh-1"), "STARTING", "Badaoui (GK) must be STARTING");

  // 3. Substituted-in players must NEVER be in STARTING:
  assert.equal(resolved.players.get("esh-3"), "SUBSTITUTE", "Ammari (subbed IN) must be SUBSTITUTE");
  assert.equal(resolved.players.get("esh-17"), "SUBSTITUTE", "Amara (subbed IN) must be SUBSTITUTE even though subbed out later");
  assert.equal(resolved.players.get("esh-34"), "SUBSTITUTE", "Boukhras (subbed IN) must be SUBSTITUTE");
  assert.equal(resolved.players.get("esh-19"), "SUBSTITUTE", "Farhat (subbed IN) must be SUBSTITUTE");

  assert.equal(resolved.hasStarterSection, true);
  assert.equal(resolved.hasBenchSection, true);
});
