// Add P2 teamAssignments namespace to the restored clean i18n files.
// IMPORTANT: This script is the ONLY correct way to modify the i18n JSON files.
// Never use PowerShell ConvertTo-Json / Set-Content with these files.
// Node.js JSON.stringify with { ensure_ascii: false } (default) preserves
// all Unicode characters correctly.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const arPath = join(root, "src", "i18n", "messages", "ar.json");
const frPath = join(root, "src", "i18n", "messages", "fr.json");

// Read (files are now clean UTF-8 from the zip restoration)
const ar = JSON.parse(readFileSync(arPath, "utf8"));
const fr = JSON.parse(readFileSync(frPath, "utf8"));

// Verify the baseline is clean before adding anything
const arTransport = ar.finance?.categories?.TRANSPORT;
const frPosted    = fr.finance?.expenseStatuses?.POSTED;
console.log("AR baseline check — finance.categories.TRANSPORT:", arTransport);
console.log("FR baseline check — finance.expenseStatuses.POSTED:", frPosted);
if (!arTransport || !/[\u0600-\u06FF]/.test(arTransport)) {
  console.error("ERROR: AR baseline is still corrupted — cannot proceed");
  process.exit(1);
}

// Add teamAssignments (idempotent: skip if already present and clean)
if (!ar.teamAssignments) {
  ar.teamAssignments = {
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
  console.log("✓ AR teamAssignments added");
} else {
  console.log("AR teamAssignments already present — skipping");
}

// Add common.remove if not present
if (!ar.common) ar.common = {};
if (!ar.common.remove) {
  ar.common.remove = "إزالة";
  console.log("✓ AR common.remove added");
}

if (!fr.teamAssignments) {
  fr.teamAssignments = {
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
  console.log("✓ FR teamAssignments added");
} else {
  console.log("FR teamAssignments already present — skipping");
}

if (!fr.common) fr.common = {};
if (!fr.common.remove) {
  fr.common.remove = "Retirer";
  console.log("✓ FR common.remove added");
}

// Write — Node.js JSON.stringify preserves all Unicode correctly
writeFileSync(arPath, JSON.stringify(ar, null, 2), "utf8");
writeFileSync(frPath, JSON.stringify(fr, null, 2), "utf8");

// Final verification
const arFinal = JSON.parse(readFileSync(arPath, "utf8"));
const frFinal = JSON.parse(readFileSync(frPath, "utf8"));
console.log("\n=== Final verification ===");
console.log("AR finance.categories.TRANSPORT:", arFinal.finance?.categories?.TRANSPORT);
console.log("AR teamAssignments.assign:", arFinal.teamAssignments?.assign);
console.log("AR common.remove:", arFinal.common?.remove);
console.log("FR teamAssignments.assign:", frFinal.teamAssignments?.assign);
console.log("FR common.remove:", frFinal.common?.remove);
console.log("FR finance.expenseStatuses.POSTED:", frFinal.finance?.expenseStatuses?.POSTED);
const arKeys = Object.keys(arFinal.teamAssignments ?? {}).sort();
const frKeys = Object.keys(frFinal.teamAssignments ?? {}).sort();
console.log("AR/FR keys match:", JSON.stringify(arKeys) === JSON.stringify(frKeys) ? "YES" : "NO — MISMATCH");
