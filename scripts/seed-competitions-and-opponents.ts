import fs from "fs/promises";
import path from "path";

const OPPONENTS_FILE = path.resolve(process.cwd(), ".storage", "opponents.json");

// Authentic local opponent teams in Tiaret & Saida regional league
const SEED_OPPONENTS: Record<string, { name: string; logoUrl: string; stadium?: string; updatedAt: string }> = {
  "crb dahmouni": {
    name: "شباب دحموني (CRB Dahmouni)",
    logoUrl: "/branding/opponents/crb-dahmouni.svg",
    stadium: "ملعب دحموني البلدي",
    updatedAt: new Date().toISOString()
  },
  "irb sougueur": {
    name: "اتحاد السوقر (IRB Sougueur)",
    logoUrl: "/branding/opponents/irb-sougueur.svg",
    stadium: "ملعب السوقر 1 نوفمبر",
    updatedAt: new Date().toISOString()
  },
  "wrb rahouia": {
    name: "اتحاد واد رهيو (WRB Rahouia)",
    logoUrl: "/branding/opponents/wrb-rahouia.svg",
    stadium: "ملعب واد رهيو البلدي",
    updatedAt: new Date().toISOString()
  },
  "js sidi hosni": {
    name: "شبيبة سيدي حسني (JS Sidi Hosni)",
    logoUrl: "/branding/opponents/js-sidi-hosni.svg",
    stadium: "الملعب البلدي سيدي حسني",
    updatedAt: new Date().toISOString()
  },
  "om mahdia": {
    name: "أولمبي مهدية (OM Mahdia)",
    logoUrl: "/branding/opponents/om-mahdia.svg",
    stadium: "ملعب مهدية البلدي",
    updatedAt: new Date().toISOString()
  },
  "fcb frenda": {
    name: "وفاق فرندة (FCB Frenda)",
    logoUrl: "/branding/opponents/fcb-frenda.svg",
    stadium: "ملعب فرندة البلدي",
    updatedAt: new Date().toISOString()
  },
  "irb ain deheb": {
    name: "اتحاد عين الذهب (IRB Ain Deheb)",
    logoUrl: "/branding/opponents/irb-ain-deheb.svg",
    stadium: "ملعب عين الذهب البلدي",
    updatedAt: new Date().toISOString()
  }
};

// Generate SVG files for opponent crests
const OPPONENT_SVGS: Record<string, string> = {
  "crb-dahmouni.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <polygon points="50,5 90,20 85,75 50,95 15,75 10,20" fill="#dc2626" stroke="#ffffff" stroke-width="3"/>
    <path d="M50 15 L80 28 L75 70 L50 85 L25 70 L20 28 Z" fill="#ffffff"/>
    <circle cx="50" cy="50" r="20" fill="#dc2626"/>
    <text x="50" y="55" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="sans-serif">CRBD</text>
  </svg>`,
  "irb-sougueur.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <polygon points="50,5 90,20 85,75 50,95 15,75 10,20" fill="#2563eb" stroke="#ffffff" stroke-width="3"/>
    <path d="M50 15 L80 28 L75 70 L50 85 L25 70 L20 28 Z" fill="#ffffff"/>
    <circle cx="50" cy="50" r="20" fill="#2563eb"/>
    <text x="50" y="55" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="sans-serif">IRBS</text>
  </svg>`,
  "wrb-rahouia.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <polygon points="50,5 90,20 85,75 50,95 15,75 10,20" fill="#059669" stroke="#ffffff" stroke-width="3"/>
    <path d="M50 15 L80 28 L75 70 L50 85 L25 70 L20 28 Z" fill="#ffffff"/>
    <circle cx="50" cy="50" r="20" fill="#059669"/>
    <text x="50" y="55" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="sans-serif">WRBR</text>
  </svg>`,
  "js-sidi-hosni.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <polygon points="50,5 90,20 85,75 50,95 15,75 10,20" fill="#d97706" stroke="#ffffff" stroke-width="3"/>
    <path d="M50 15 L80 28 L75 70 L50 85 L25 70 L20 28 Z" fill="#ffffff"/>
    <circle cx="50" cy="50" r="20" fill="#d97706"/>
    <text x="50" y="55" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="sans-serif">JSSH</text>
  </svg>`,
  "om-mahdia.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <polygon points="50,5 90,20 85,75 50,95 15,75 10,20" fill="#7c3aed" stroke="#ffffff" stroke-width="3"/>
    <path d="M50 15 L80 28 L75 70 L50 85 L25 70 L20 28 Z" fill="#ffffff"/>
    <circle cx="50" cy="50" r="20" fill="#7c3aed"/>
    <text x="50" y="55" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="sans-serif">OMM</text>
  </svg>`,
  "fcb-frenda.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <polygon points="50,5 90,20 85,75 50,95 15,75 10,20" fill="#0891b2" stroke="#ffffff" stroke-width="3"/>
    <path d="M50 15 L80 28 L75 70 L50 85 L25 70 L20 28 Z" fill="#ffffff"/>
    <circle cx="50" cy="50" r="20" fill="#0891b2"/>
    <text x="50" y="55" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="sans-serif">FCBF</text>
  </svg>`,
  "irb-ain-deheb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <polygon points="50,5 90,20 85,75 50,95 15,75 10,20" fill="#4b5563" stroke="#ffffff" stroke-width="3"/>
    <path d="M50 15 L80 28 L75 70 L50 85 L25 70 L20 28 Z" fill="#ffffff"/>
    <circle cx="50" cy="50" r="20" fill="#4b5563"/>
    <text x="50" y="55" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="sans-serif">IRBA</text>
  </svg>`
};

async function main() {
  // 1. Create opponents SVGs on disk
  const oppDir = path.resolve(process.cwd(), "public", "branding", "opponents");
  await fs.mkdir(oppDir, { recursive: true });
  for (const [filename, svg] of Object.entries(OPPONENT_SVGS)) {
    const svgPath = path.join(oppDir, filename);
    try {
      await fs.access(svgPath);
    } catch {
      await fs.writeFile(svgPath, svg, "utf-8");
    }
  }
  console.log("Missing opponent branding SVGs created; existing files preserved.");

  // 2. Save .storage/opponents.json
  await fs.mkdir(path.dirname(OPPONENTS_FILE), { recursive: true });
  let savedOpponents: Record<string, unknown> = {};
  try {
    savedOpponents = JSON.parse(await fs.readFile(OPPONENTS_FILE, "utf-8"));
  } catch {
    // No saved directory yet; initialize from known opponent directory entries.
  }
  await fs.writeFile(OPPONENTS_FILE, JSON.stringify({ ...SEED_OPPONENTS, ...savedOpponents }, null, 2), "utf-8");
  console.log("Opponent directory initialized without removing saved entries.");

  console.log("Opponent assets refreshed. Competition standings, fixtures, and results are never seeded or overwritten.");
}

main().catch(console.error).finally(() => process.exit(0));
