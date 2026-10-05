import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const braces = require(fileURLToPath(new URL("../vendor/braces/index.js", import.meta.url)));

assert.deepEqual(braces("a{b,c}"), ["a(b|c)"]);
assert.throws(
  () => braces("{".repeat(101) + "x" + "}".repeat(101)),
  { name: "SyntaxError", message: "Brace nesting exceeds the maximum depth (100)" }
);

process.stdout.write("braces expansion compatibility and depth limit verified\n");
