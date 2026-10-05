// Deeper fix: the file has double-encoded UTF-8 content.
// When PowerShell wrote the JSON, Arabic strings (originally valid UTF-8)
// were re-interpreted as Windows-1252 / Latin-1 codepoints and each byte
// was emitted as a separate UTF-8 character.
//
// Example: نقل (U+0646 U+0642 U+0644) in UTF-8 = bytes D9 86 D9 82 D9 84
// Those 6 bytes, read as Latin-1, become: Ù† Ù‚ Ù„
// Re-encoded as UTF-8 they become a longer sequence that displays as ظ†ظ‚ظ„
//
// Recovery: read the file as Latin-1, then re-encode as UTF-8.
// This reverses exactly one round-trip of the Windows-1252 mis-encoding.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function recoverDoubleEncoded(filePath) {
  // Read file bytes as Latin-1 (1:1 byte mapping — no interpretation)
  const raw = readFileSync(filePath, "latin1");

  // Test: does Latin-1 decode + re-parse give valid Arabic?
  try {
    // The raw string is the Latin-1 view of the bytes; reinterpret as UTF-8
    const asUtf8 = Buffer.from(raw, "latin1").toString("utf8");
    const parsed = JSON.parse(asUtf8);

    // Look for Arabic characters in a known finance key
    const transport = parsed.finance?.expense?.categories?.TRANSPORT;
    if (transport && /[\u0600-\u06FF]/.test(transport)) {
      console.log("✓ Recovery succeeded for", filePath);
      console.log("  TRANSPORT =", transport);
      return { content: asUtf8, parsed };
    } else {
      console.log("✗ Recovery did not produce valid Arabic for", filePath);
      console.log("  TRANSPORT =", transport);
      return null;
    }
  } catch (e) {
    console.log("✗ Failed to parse after recovery:", e.message);
    return null;
  }
}

const arPath = join(root, "src", "i18n", "messages", "ar.json");
const frPath = join(root, "src", "i18n", "messages", "fr.json");

// Recover AR
const arResult = recoverDoubleEncoded(arPath);
if (!arResult) {
  console.error("Cannot recover ar.json — manual intervention needed");
  process.exit(1);
}

// Recover FR (check if it's also affected)
const frRaw = readFileSync(frPath, "utf8");
const frParsed = JSON.parse(frRaw);
const frPosted = frParsed.finance?.expense?.statuses?.POSTED;
console.log("FR POSTED (direct UTF-8):", frPosted);

let frResult;
if (frPosted && /[éàèùâêîôûçëïü]/i.test(frPosted)) {
  console.log("FR file is OK (valid accents found)");
  frResult = { content: frRaw, parsed: frParsed };
} else {
  // Try recovery
  frResult = recoverDoubleEncoded(frPath);
}

if (!frResult) {
  console.error("Cannot recover fr.json — manual intervention needed");
  process.exit(1);
}

// Now add teamAssignments to the recovered AR
const arParsed = arResult.parsed;
if (!arParsed.teamAssignments) {
  arParsed.teamAssignments = {
    title: "تعيينات الفريق (التفويض)",
    staffTitle: "تعيينات الفريق (تشغيلية)",
    userHint: "تحدد هذه التعيينات الفرق التي يمكن لهذا المستخدم الوصول إليها عندما يكون دوره محدوداً بالفريق.",
    staffHint: "تحدد هذه التعيينات الفرق التي يعمل معها هذا العضو يومياً. لا تمنح صلاحيات تسجيل الدخول.",
    noAssignments: "لم يتم تعيين أي فريق بعد.",
    addTeam: "إضافة فريق",
    assign: "تعيين",
    teamScopedWarning: "دور هذا المستخدم محدود بالفريق. سيتمكن فقط من الوصول إلى بيانات الفرق المعيّنة له.",
    notTeamScopedNote: "دور هذا المستخدم غير محدود بالفريق، لذا لن تؤثر هذه التعيينات على صلاحياته حتى يتم تفعيل التحكم بالوصول.",
    errors: {
      teamRequired: "الرجاء اختيار فريق",
      alreadyAssigned: "هذا المستخدم معيّن لهذا الفريق مسبقاً"
    }
  };
}
if (!arParsed.common) arParsed.common = {};
if (!arParsed.common.remove) arParsed.common.remove = "إزالة";

// Add teamAssignments to the recovered FR
const frParsedOut = frResult.parsed;
if (!frParsedOut.teamAssignments) {
  frParsedOut.teamAssignments = {
    title: "Équipes autorisées",
    staffTitle: "Équipes opérationnelles",
    userHint: "Ces équipes définissent les données auxquelles cet utilisateur peut accéder si son rôle est limité à une équipe.",
    staffHint: "Ces équipes indiquent avec quelles équipes ce membre du staff travaille au quotidien. Elles ne donnent aucun accès à la plateforme.",
    noAssignments: "Aucune équipe assignée.",
    addTeam: "Ajouter une équipe",
    assign: "Assigner",
    teamScopedWarning: "Le rôle de cet utilisateur est limité à ses équipes assignées. Il ne pourra accéder qu'aux données de ces équipes.",
    notTeamScopedNote: "Le rôle de cet utilisateur n'est pas limité à une équipe. Les assignations n'affecteront les droits qu'une fois le contrôle d'accès activé.",
    errors: {
      teamRequired: "Veuillez sélectionner une équipe",
      alreadyAssigned: "Cet utilisateur est déjà assigné à cette équipe"
    }
  };
}
if (!frParsedOut.common) frParsedOut.common = {};
if (!frParsedOut.common.remove) frParsedOut.common.remove = "Retirer";

// Write both files as clean UTF-8 JSON (no BOM, no escaping of non-ASCII)
writeFileSync(arPath, JSON.stringify(arParsed, null, 2), { encoding: "utf8" });
writeFileSync(frPath, JSON.stringify(frParsedOut, null, 2), { encoding: "utf8" });

// Final verification
const arFinal = JSON.parse(readFileSync(arPath, "utf8"));
const frFinal = JSON.parse(readFileSync(frPath, "utf8"));
console.log("\n=== Final verification ===");
console.log("AR TRANSPORT:", arFinal.finance?.expense?.categories?.TRANSPORT);
console.log("AR teamAssignments:", Object.keys(arFinal.teamAssignments ?? {}).join(", "));
console.log("AR common.remove:", arFinal.common?.remove);
console.log("FR teamAssignments:", Object.keys(frFinal.teamAssignments ?? {}).join(", "));
console.log("FR common.remove:", frFinal.common?.remove);
console.log("FR POSTED:", frFinal.finance?.expense?.statuses?.POSTED);
