#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = await fs.readFile(path.join(root, "prisma", "schema.prisma"), "utf8");
const withoutWorker = source.replace(/\ngenerator clientWorker \{[\s\S]*?\n\}\n\n(?=datasource db)/, "\n");
const mysql = withoutWorker
  .replace('provider = "prisma-client-js"\n  engineType = "client"', 'provider = "prisma-client-js"\n  output = "../.generated/prisma-mysql"')
  .replace('provider = "postgresql"', 'provider = "mysql"')
  .replace(/String\[\]/g, "Json")
  .replace(/\s+@default\(\[\]\)/g, "");
await fs.writeFile(path.join(root, "prisma", "schema.mysql.prisma"), mysql, "utf8");
console.log("Generated prisma/schema.mysql.prisma for cPanel/MariaDB.");
