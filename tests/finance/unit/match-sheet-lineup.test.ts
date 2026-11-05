import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectPlayers,
  detectOfficialCaptain,
  detectOfficialShirtNumbers,
  type SheetPlayer
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
