import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const mimeByExtension = new Map([
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".png", "image/png"], [".webp", "image/webp"],
  [".mp4", "video/mp4"], [".webm", "video/webm"], [".mov", "video/quicktime"]
]);
const storageRoots = [...new Set([
  path.resolve(process.cwd(), ".storage", "public"),
  process.env.STORAGE_LOCAL_ROOT
    ? path.resolve(process.env.STORAGE_LOCAL_ROOT, "public")
    : null,
  process.env.LOCALAPPDATA
    ? path.resolve(process.env.LOCALAPPDATA, "ESH Football Platform", ".storage", "public")
    : null
].filter(Boolean))];

async function collectFiles(directory) {
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

const checksum = (buffer) => createHash("sha256").update(buffer).digest("hex");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

try {
  const pendingDeletion = [];
  let copied = 0;
  let alreadyPresent = 0;

  for (const root of storageRoots) {
    for (const filePath of await collectFiles(root)) {
      const extension = path.extname(filePath).toLowerCase();
      const mimeType = mimeByExtension.get(extension);
      if (!mimeType) throw new Error(`Unsupported public asset type: ${extension || "(none)"}`);
      const relative = path.relative(root, filePath).split(path.sep).join("/");
      const key = relative.startsWith("public/") ? relative : `public/${relative}`;
      const data = await fs.readFile(filePath);
      const existing = await prisma.publicAsset.findUnique({ where: { key }, select: { data: true } });

      if (existing) {
        if (checksum(Buffer.from(existing.data)) !== checksum(data)) {
          throw new Error(`A database asset already uses this key but has different content: ${key}`);
        }
        alreadyPresent++;
      } else {
        await prisma.publicAsset.create({
          data: { key, mimeType, sizeBytes: data.byteLength, data }
        });
        const stored = await prisma.publicAsset.findUnique({ where: { key }, select: { data: true, sizeBytes: true } });
        if (!stored || stored.sizeBytes !== data.byteLength || checksum(Buffer.from(stored.data)) !== checksum(data)) {
          throw new Error(`Database verification failed; original file was preserved: ${key}`);
        }
        copied++;
      }
      pendingDeletion.push(filePath);
    }
  }

  console.log(`Verified ${pendingDeletion.length} local media file(s): ${copied} copied, ${alreadyPresent} already present.`);
  if (process.argv.includes("--delete-source")) {
    for (const filePath of pendingDeletion) await fs.unlink(filePath);
    console.log("Removed verified source files from local storage.");
  } else {
    console.log("Source files were retained. Re-run with --delete-source after reviewing the verified copy.");
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
