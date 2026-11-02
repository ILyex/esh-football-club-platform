import { test } from "node:test";
import assert from "node:assert/strict";
import { getPlayerDisplayName } from "@/lib/utils";

const coach = {
  firstName: "عرابي",
  lastName: "اوبيكر المسديقي",
  firstNameFr: "Arabi",
  lastNameFr: "Oubiker El Mesdaoui"
};

test("French locale shows the coach name in Latin script", () => {
  assert.equal(getPlayerDisplayName(coach, "fr"), "Arabi Oubiker El Mesdaoui");
});

test("Arabic locale keeps the Arabic spelling", () => {
  assert.equal(getPlayerDisplayName(coach, "ar"), "عرابي اوبيكر المسديقي");
});

test("French locale falls back to Arabic when no French name is on file", () => {
  const arabicOnly = { firstName: "كريم", lastName: "بن علي", firstNameFr: null, lastNameFr: null };
  assert.equal(getPlayerDisplayName(arabicOnly, "fr"), "كريم بن علي");
});

test("Arabic locale falls back to French when the Arabic pair is empty", () => {
  const frenchOnly = { firstName: "", lastName: "", firstNameFr: "Karim", lastNameFr: "Benali" };
  assert.equal(getPlayerDisplayName(frenchOnly, "ar"), "Karim Benali");
});

test("missing fields never produce 'undefined' or a double space", () => {
  assert.equal(getPlayerDisplayName({ firstName: "Sami", lastName: null }, "fr"), "Sami");
  assert.equal(getPlayerDisplayName({}, "fr"), "");
});
