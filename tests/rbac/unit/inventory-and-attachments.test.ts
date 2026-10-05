import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inventoryItemSchema } from "@/lib/validations/inventory";

const ROOT = join(__dirname, "..", "..", "..");

function readFile(subpath: string): string {
  return readFileSync(join(ROOT, subpath), "utf8");
}

// ---------------------------------------------------------------------------
// Part 1 — inventoryItemSchema validation tests
// ---------------------------------------------------------------------------

test("inventoryItemSchema: validates correct equipment inputs", () => {
  const result = inventoryItemSchema.safeParse({
    name: "Ballons T5 Molten",
    category: "BALLS",
    quantity: 15,
    condition: "GOOD",
    location: "Vestiaire",
    teamId: "clteam123456789012345678",
    notes: "Donation FAF"
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.name, "Ballons T5 Molten");
    assert.equal(result.data.quantity, 15);
    assert.equal(result.data.category, "BALLS");
    assert.equal(result.data.condition, "GOOD");
  }
});

test("inventoryItemSchema: rejects empty item name", () => {
  const result = inventoryItemSchema.safeParse({
    name: "   ",
    category: "BALLS",
    quantity: 10
  });

  assert.equal(result.success, false);
});

test("inventoryItemSchema: rejects 0 or negative quantity", () => {
  const resultZero = inventoryItemSchema.safeParse({
    name: "Plot de cônes",
    quantity: 0
  });
  assert.equal(resultZero.success, false);

  const resultNeg = inventoryItemSchema.safeParse({
    name: "Plot de cônes",
    quantity: -5
  });
  assert.equal(resultNeg.success, false);
});

test("inventoryItemSchema: applies default category OTHER and condition GOOD", () => {
  const result = inventoryItemSchema.safeParse({
    name: "Chronomètre arbitre"
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.category, "OTHER");
    assert.equal(result.data.condition, "GOOD");
    assert.equal(result.data.quantity, 1);
  }
});

// ---------------------------------------------------------------------------
// Part 2 — Structural & Security Invariants
// ---------------------------------------------------------------------------

test("Inventory actions: enforces RBAC, team scoping, and audit logging", () => {
  const content = readFile("src/app/[locale]/(dashboard)/dashboard/inventory/actions.ts");

  // RBAC check present
  assert.ok(content.includes("requireInventoryManage"), "Actions must call requireInventoryManage");
  assert.ok(content.includes("ForbiddenError"), "Actions must throw ForbiddenError when unauthorized");

  // Team scoping guards present
  assert.ok(content.includes("assertTeamScope"), "Actions must enforce assertTeamScope on create/delete");
  assert.ok(content.includes("assertDualTeamScope"), "Actions must enforce assertDualTeamScope on update");

  // Audit logging present on all mutations
  assert.ok(content.includes("writeAuditLog"), "Actions must write audit logs");
  assert.ok(content.includes("inventory.create"), "Audit log for inventory.create must exist");
  assert.ok(content.includes("inventory.update"), "Audit log for inventory.update must exist");
  assert.ok(content.includes("inventory.delete"), "Audit log for inventory.delete must exist");
});

test("Correspondence actions: supports direct file upload with validation and audit", () => {
  const content = readFile("src/app/[locale]/(dashboard)/dashboard/correspondence/actions.ts");

  assert.ok(content.includes("validateUploadedFile"), "Correspondence action must validate uploaded file bytes");
  assert.ok(content.includes("uploadPrivateFile"), "Correspondence action must store files in private storage");
  assert.ok(content.includes("uploadAndAttachCorrespondenceDocumentAction"), "uploadAndAttach action must exist");
  assert.ok(content.includes("correspondence.upload_attach"), "Audit log for upload_attach must exist");
});

test("Meeting Minutes actions: supports direct file upload with validation and audit", () => {
  const content = readFile("src/app/[locale]/(dashboard)/dashboard/meeting-minutes/actions.ts");

  assert.ok(content.includes("validateUploadedFile"), "Meeting minutes action must validate uploaded file bytes");
  assert.ok(content.includes("uploadPrivateFile"), "Meeting minutes action must store files in private storage");
  assert.ok(content.includes("uploadAndAttachMeetingDocumentAction"), "uploadAndAttach action must exist");
  assert.ok(content.includes("meeting.upload_attach"), "Audit log for meeting upload_attach must exist");
});

test("Detail views: render direct document download endpoints", () => {
  const corrDetail = readFile("src/app/[locale]/(dashboard)/dashboard/correspondence/[id]/page.tsx");
  assert.ok(corrDetail.includes("/api/documents/"), "Correspondence detail must link to document download");
  assert.ok(corrDetail.includes("/download"), "Correspondence detail must use /download endpoint");

  const meetDetail = readFile("src/app/[locale]/(dashboard)/dashboard/meeting-minutes/[id]/page.tsx");
  assert.ok(meetDetail.includes("/api/documents/"), "Meeting minute detail must link to document download");
  assert.ok(meetDetail.includes("/download"), "Meeting minute detail must use /download endpoint");
});

test("i18n Parity: Inventory namespace identical in ar.json and fr.json", () => {
  const ar = JSON.parse(readFile("src/i18n/messages/ar.json"));
  const fr = JSON.parse(readFile("src/i18n/messages/fr.json"));

  assert.ok(ar.inventory, "ar.json must have inventory namespace");
  assert.ok(fr.inventory, "fr.json must have inventory namespace");

  const arKeys = Object.keys(ar.inventory).sort();
  const frKeys = Object.keys(fr.inventory).sort();
  assert.deepEqual(arKeys, frKeys, "Inventory top-level keys must match between AR and FR");

  const arCatKeys = Object.keys(ar.inventory.categories).sort();
  const frCatKeys = Object.keys(fr.inventory.categories).sort();
  assert.deepEqual(arCatKeys, frCatKeys, "Inventory category keys must match between AR and FR");

  const arCondKeys = Object.keys(ar.inventory.conditions).sort();
  const frCondKeys = Object.keys(fr.inventory.conditions).sort();
  assert.deepEqual(arCondKeys, frCondKeys, "Inventory condition keys must match between AR and FR");
});
