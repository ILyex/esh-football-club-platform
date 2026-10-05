import test from "node:test";
import assert from "node:assert/strict";
import { playerSchema } from "@/lib/validations/player";
import { parseDMYToISO, parseISOToDMY } from "@/lib/documents/insurance-helper";
import { checkPlayerDocument, matchPlayerName } from "@/lib/documents/verification-rules";

test("playerSchema validates licenceNumber correctly", () => {
  const result = playerSchema.safeParse({
    firstName: "كريم",
    lastName: "بن علي",
    position: "FORWARD",
    nationality: "جزائرية",
    dateOfBirth: new Date("2004-05-12"),
    teamId: "team-1",
    licenceNumber: "26/98745"
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.licenceNumber, "26/98745");
  }
});

test("parseDMYToISO converts DD/MM/YYYY to YYYY-MM-DD without reversing day and month", () => {
  assert.equal(parseDMYToISO("15/09/2026"), "2026-09-15");
  assert.equal(parseDMYToISO("05/10/2026"), "2026-10-05");
  assert.equal(parseDMYToISO("30/06/2027"), "2027-06-30");
  assert.equal(parseDMYToISO("2026-09-15"), "2026-09-15");
  assert.equal(parseDMYToISO(null), null);
});

test("parseISOToDMY converts ISO string to DD/MM/YYYY", () => {
  assert.equal(parseISOToDMY("2026-09-15"), "15/09/2026");
  assert.equal(parseISOToDMY("2026-10-05"), "05/10/2026");
});

test("checkPlayerDocument rejects document belonging to another player (bilingual)", () => {
  const docText = `
    RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE
    ATTESTATION D'ASSURANCE SPORTIVE
    SOCIÉTÉ NATIONALE D'ASSURANCE - SAA
    Police N° ASSUR-2026-9812
    Souscripteur: Espoir Sidi Hosni
    Assuré: KADRI ALI
    Valable du 15/08/2026 au 30/06/2027
  `;

  const result = checkPlayerDocument({
    text: docText,
    player: {
      firstName: "كريم",
      lastName: "بن علي",
      firstNameFr: "BENALI",
      lastNameFr: "Karim"
    },
    otherPlayers: [
      {
        firstName: "علي",
        lastName: "قادري",
        firstNameFr: "KADRI",
        lastNameFr: "Ali"
      }
    ],
    kind: "INSURANCE"
  });

  assert.equal(result.verdict, "REJECT");
  const otherPlayerFinding = result.findings.find((f) => f.code === "OTHER_PLAYER");
  assert.ok(otherPlayerFinding, "Should detect OTHER_PLAYER finding");
});

test("checkPlayerDocument accepts matching bilingual player insurance certificate", () => {
  const docText = `
    RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE
    ATTESTATION D'ASSURANCE SPORTIVE
    CAAR ASSURANCE TIARET
    Police N° CAAR-2026-441
    Assuré: BENALI KARIM
    Catégorie: Seniors
    Valable du 15/08/2026 au 30/06/2027
  `;

  const result = checkPlayerDocument({
    text: docText,
    player: {
      firstName: "كريم",
      lastName: "بن علي",
      firstNameFr: "BENALI",
      lastNameFr: "Karim"
    },
    otherPlayers: [
      {
        firstName: "علي",
        lastName: "قادري",
        firstNameFr: "KADRI",
        lastNameFr: "Ali"
      }
    ],
    kind: "INSURANCE"
  });

  assert.equal(result.verdict, "ACCEPT");
  const okName = result.findings.find((f) => f.code === "OK_NAME");
  assert.ok(okName, "Should have OK_NAME finding");
});

test("checkPlayerDocument rejects non-insurance document", () => {
  const docText = `
    BORDEREAU D'ENVOI
    WILAYA DE TIARET
    Monsieur le Président de l'APC
    Affaire: Rénovation des vestiaires
  `;

  const result = checkPlayerDocument({
    text: docText,
    player: {
      firstName: "كريم",
      lastName: "بن علي"
    },
    otherPlayers: [],
    kind: "INSURANCE"
  });

  assert.equal(result.verdict, "REJECT");
  const wrongType = result.findings.find((f) => f.code === "WRONG_DOCUMENT_TYPE");
  assert.ok(wrongType, "Should detect WRONG_DOCUMENT_TYPE");
});

test("checkPlayerDocument does not classify generic football paperwork as insurance", () => {
  const docText = `
    Ligue Régionale de Football
    Feuille de match officielle — Catégorie sportive
    Joueur: BENALI KARIM
    Fédération et calendrier de la saison
  `;

  const result = checkPlayerDocument({
    text: docText,
    player: {
      firstName: "Karim",
      lastName: "Benali"
    },
    otherPlayers: [],
    kind: "INSURANCE"
  });

  assert.equal(result.verdict, "REJECT");
  assert.ok(result.findings.some((finding) => finding.code === "WRONG_DOCUMENT_TYPE"));
});

test("getPlayerDisplayName provides intelligent Arabic vs French bidirectional fallback", async () => {
  const { getPlayerDisplayName } = await import("@/lib/utils");

  // Player with both Arabic and French names
  const bilingual = {
    firstName: "كريم",
    lastName: "بن علي",
    firstNameFr: "Karim",
    lastNameFr: "Benali"
  };

  assert.equal(getPlayerDisplayName(bilingual, "ar"), "كريم بن علي");
  assert.equal(getPlayerDisplayName(bilingual, "fr"), "Karim Benali");

  // Player with only Arabic name
  const arabicOnly = {
    firstName: "عبد القادر",
    lastName: "منصوري",
    firstNameFr: null,
    lastNameFr: null
  };

  // In French mode, falls back to Arabic if French is absent
  assert.equal(getPlayerDisplayName(arabicOnly, "fr"), "عبد القادر منصوري");
  assert.equal(getPlayerDisplayName(arabicOnly, "ar"), "عبد القادر منصوري");

  // Staff/Player with only French name
  const frenchOnly = {
    firstName: "",
    lastName: "",
    firstNameFr: "Yacine",
    lastNameFr: "Brahimi"
  };

  // In Arabic mode, falls back to French if Arabic is absent
  assert.equal(getPlayerDisplayName(frenchOnly, "ar"), "Yacine Brahimi");
  assert.equal(getPlayerDisplayName(frenchOnly, "fr"), "Yacine Brahimi");
});
