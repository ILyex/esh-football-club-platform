#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = await fs.readFile(path.join(root, "prisma", "schema.prisma"), "utf8");
const withoutWorker = source.replace(/\ngenerator clientWorker \{[\s\S]*?\n\}\n\n(?=datasource db)/, "\n");
const mysql = withoutWorker
  .replace(/(generator client\s*\{)([\s\S]*?)(\r?\n\})/, (_match, start, body, end) => {
    const clientBody = body.replace(/^\s*output\s*=.*\r?\n/gm, "");
    return start + clientBody + '\n  output = "../.generated/prisma-mysql"' + end;
  })
  .replace(/(datasource db\s*\{[\s\S]*?\bprovider\s*=\s*)"postgresql"/, '$1"mysql"')
  .replace(/String\[\]/g, "Json")
  .replace(/\s+@default\(\[\]\)/g, "");
if (!/generator client\s*\{[^}]*output\s*=\s*"\.\.\/\.generated\/prisma-mysql"/s.test(mysql) ||
    !/datasource db\s*\{[^}]*provider\s*=\s*"mysql"/s.test(mysql)) {
  throw new Error("Failed to create an isolated MySQL Prisma Client schema; refusing to generate into the default client.");
}
await fs.writeFile(path.join(root, "prisma", "schema.mysql.prisma"), mysql, "utf8");
console.log("Generated prisma/schema.mysql.prisma for cPanel/MariaDB.");
