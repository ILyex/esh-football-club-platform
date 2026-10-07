#!/usr/bin/env node
/** Create a verifiable PostgreSQL export for the PHP/MySQL migration. */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outputRoot = path.resolve(outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : ".migration-export");
const connectionString = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing SOURCE_DATABASE_URL or DATABASE_URL.");
  process.exit(2);
}

const safeFileName = (value) => value.replace(/[^a-zA-Z0-9_.-]/g, "_");
const replacer = (_key, value) => {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { __type: "buffer", base64: value.toString("base64") };
  if (typeof value === "bigint") return { __type: "bigint", value: value.toString() };
  return value;
};

await fs.mkdir(path.join(outputRoot, "tables"), { recursive: true });
const pool = new Pool({ connectionString, max: 2, idleTimeoutMillis: 10_000 });
const client = await pool.connect();
const manifest = { format: 1, source: "postgresql", exportedAt: new Date().toISOString(), tables: [] };
try {
  const { rows: tables } = await client.query(`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
  for (const table of tables) {
    const schema = table.table_schema.replaceAll('"', '""');
    const name = table.table_name.replaceAll('"', '""');
    const qualified = `"${schema}"."${name}"`;
    const { rows: columns } = await client.query(
      `SELECT column_name, data_type, udt_name, is_nullable, ordinal_position
       FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      [table.table_schema, table.table_name]);
    const { rows } = await client.query(`SELECT * FROM ${qualified}`);
    const fileName = `${safeFileName(table.table_schema)}.${safeFileName(table.table_name)}.ndjson`;
    const body = rows.map((row) => `${JSON.stringify(row, replacer)}\n`).join("");
    await fs.writeFile(path.join(outputRoot, "tables", fileName), body, "utf8");
    manifest.tables.push({ schema: table.table_schema, name: table.table_name, file: `tables/${fileName}`, rows: rows.length,
      sha256: crypto.createHash("sha256").update(body).digest("hex"), columns });
    console.log(`${table.table_name}: ${rows.length} rows`);
  }
  manifest.tableCount = manifest.tables.length;
  manifest.rowCount = manifest.tables.reduce((sum, table) => sum + table.rows, 0);
  await fs.writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Export complete: ${manifest.tableCount} tables, ${manifest.rowCount} rows`);
  console.log(`Output: ${outputRoot}`);
} finally {
  client.release();
  await pool.end();
}
