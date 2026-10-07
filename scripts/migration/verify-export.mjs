#!/usr/bin/env node
/** Verify an export without opening or logging row contents. */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const root = path.resolve(process.argv[2] || ".migration-export");
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
let rows = 0;
for (const table of manifest.tables) {
  const body = await fs.readFile(path.join(root, table.file));
  if (crypto.createHash("sha256").update(body).digest("hex") !== table.sha256) throw new Error(`Checksum mismatch: ${table.name}`);
  const lineCount = body.length === 0 ? 0 : body.toString("utf8").trimEnd().split("\n").length;
  if (lineCount !== table.rows) throw new Error(`Row count mismatch: ${table.name}`);
  rows += lineCount;
}
if (rows !== manifest.rowCount) throw new Error("Manifest row total mismatch");
console.log(`Verified ${manifest.tableCount} tables and ${rows} rows.`);
