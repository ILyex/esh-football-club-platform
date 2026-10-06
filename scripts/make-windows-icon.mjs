import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "public", "branding", "esh-logo-256.png");
const target = path.join(root, "public", "branding", "esh-logo.ico");
const png = fs.readFileSync(source);

// Windows accepts a PNG payload inside an ICO container. The source is already
// a square 256px logo, so no lossy conversion or external binary is needed.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // icon type
header.writeUInt16LE(1, 4); // image count

const directory = Buffer.alloc(16);
directory[0] = 0; // width 256 is represented by zero
directory[1] = 0; // height 256 is represented by zero
directory[2] = 0; // palette colors
directory[3] = 0;
directory.writeUInt16LE(1, 4); // color planes
directory.writeUInt16LE(32, 6); // bits per pixel
directory.writeUInt32LE(png.length, 8);
directory.writeUInt32LE(22, 12); // header + one directory entry

fs.writeFileSync(target, Buffer.concat([header, directory, png]));
console.log(`Created ${path.relative(root, target)}`);
