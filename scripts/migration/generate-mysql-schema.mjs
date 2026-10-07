#!/usr/bin/env node
/** Generate a conservative MySQL 8 schema from a verified export manifest. */
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".migration-export");
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
const outFile = path.join(root, "schema.mysql.sql");
const excluded = new Set(["_prisma_migrations"]);
const quote = (value) => `\`${value.replaceAll("`", "``")}\``;

function mysqlType(column) {
  const type = `${column.data_type} ${column.udt_name}`.toLowerCase();
  const name = column.column_name.toLowerCase();
  if (name === "id" || name.endsWith("id") || ["key", "email", "name", "shortname", "status", "category", "type", "url", "tokenhash", "code"].includes(name)) return "VARCHAR(191)";
  if (type.includes("boolean")) return "TINYINT(1)";
  if (type.includes("bigint")) return "BIGINT";
  if (type.includes("smallint")) return "SMALLINT";
  if (type.includes("integer") || type.includes("int")) return "INT";
  if (type.includes("double") || type.includes("real") || type.includes("numeric") || type.includes("decimal")) return "DECIMAL(30,10)";
  if (type.includes("timestamp") || type.includes("date")) return "DATETIME(3)";
  if (type.includes("json")) return "JSON";
  if (type.includes("bytea")) return "LONGBLOB";
  if (type.includes("uuid") || type.includes("character varying") || type.includes("varchar")) return "VARCHAR(191)";
  return "LONGTEXT";
}

const lines = [
  "-- Generated from the verified PostgreSQL export. Review foreign keys and defaults before production cutover.",
  "SET NAMES utf8mb4;",
  "SET FOREIGN_KEY_CHECKS=0;",
  "",
];
for (const table of manifest.tables.filter((item) => !excluded.has(item.name))) {
  const columns = table.columns.map((column) => {
    const nullable = column.is_nullable === "YES" ? "NULL" : "NOT NULL";
    return `  ${quote(column.column_name)} ${mysqlType(column)} ${nullable}`;
  });
  const id = table.columns.find((column) => column.column_name === "id");
  if (id) columns.push(`  PRIMARY KEY (${quote("id")})`);
  lines.push(`CREATE TABLE IF NOT EXISTS ${quote(table.name)} (`);
  lines.push(columns.join(",\n"));
  lines.push(") ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
  lines.push("");
}
lines.push("SET FOREIGN_KEY_CHECKS=1;", "");
await fs.writeFile(outFile, `${lines.join("\n")}\n`, "utf8");
console.log(`Generated ${path.relative(process.cwd(), outFile)} for ${manifest.tables.length - excluded.size} tables.`);
