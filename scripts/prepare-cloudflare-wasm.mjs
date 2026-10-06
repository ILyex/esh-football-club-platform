import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = join(root, ".next", "server", "chunks", "static", "wasm");
const server = join(root, ".open-next", "server-functions", "default");
const target = join(server, "static", "wasm");
const handlerPath = join(server, "handler.mjs");

if (!existsSync(source) || !existsSync(handlerPath)) {
  throw new Error("OpenNext build output or Prisma WebAssembly assets are missing.");
}

const files = readdirSync(source).filter((file) => /^[a-f0-9]+\.wasm$/i.test(file));
if (files.length === 0) throw new Error("No hashed WebAssembly assets were emitted by Next.js.");

mkdirSync(target, { recursive: true });
for (const file of files) cpSync(join(source, file), join(target, file));

const imports = files.map((file, index) => `import wasm${index} from "./static/wasm/${file}";`).join("\n");
const cases = files.map((file, index) => `    case "${file.slice(0, -5)}": return wasm${index};`).join("\n");
const loaderPath = join(server, "prisma-wasm-loader.mjs");
writeFileSync(loaderPath, `${imports}\n\nexport function loadPrismaWasm(hash) {\n  switch (hash) {\n${cases}\n    default: throw new Error("Unknown Prisma WebAssembly chunk: " + hash);\n  }\n}\n`);

const importLine = 'import { loadPrismaWasm } from "./prisma-wasm-loader.mjs";\n';
const handler = readFileSync(handlerPath, "utf8");
const moduleHashes = new Map();
for (const match of handler.matchAll(/(\d+):\(a2,b3,c3\)=>\{var d3=c3\(\d+\);a2\.exports=c3\.v\(b3,a2\.id,"([a-f0-9]+)"/g)) {
  moduleHashes.set(match[1], match[2]);
}

const getter = /getQueryCompilerWasmModule:async\(\)=>\{let\{default:(\w+)\}=await c3\.e\(\d+\)\.then\(c3\.bind\(c3,(\d+)\)\);return \1\}/g;
let patchedGetters = 0;
const patched = handler.replace(getter, (_source, _moduleName, moduleId) => {
  const hash = moduleHashes.get(moduleId);
  if (!hash || !files.includes(`${hash}.wasm`)) {
    throw new Error(`Could not map Prisma WebAssembly chunk module ${moduleId} to a compiled asset.`);
  }
  patchedGetters += 1;
  return `getQueryCompilerWasmModule:async()=>loadPrismaWasm("${hash}")`;
});
if (patchedGetters === 0) {
  throw new Error("Could not safely identify the bundled Prisma WebAssembly module imports; refusing to ship a broken Worker.");
}

writeFileSync(handlerPath, patched.startsWith(importLine) ? patched : importLine + patched);
console.log(`Prepared ${patchedGetters} Prisma client(s) with ${files.length} statically compiled WebAssembly module(s) for Cloudflare Workers.`);
