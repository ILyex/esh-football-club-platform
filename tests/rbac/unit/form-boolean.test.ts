import { test } from "node:test";
import assert from "node:assert/strict";
import { formBoolean } from "@/lib/validations/form-values";

test("formBoolean handles browser form strings and omitted values", () => {
  const enabledByDefault = formBoolean(true);
  const disabledByDefault = formBoolean(false);

  assert.equal(enabledByDefault.parse(undefined), true);
  assert.equal(disabledByDefault.parse(undefined), false);
  assert.equal(enabledByDefault.parse("on"), true);
  assert.equal(enabledByDefault.parse("true"), true);
  assert.equal(disabledByDefault.parse("false"), false);
  assert.equal(disabledByDefault.parse(""), false);
  assert.equal(disabledByDefault.parse(false), false);
});
