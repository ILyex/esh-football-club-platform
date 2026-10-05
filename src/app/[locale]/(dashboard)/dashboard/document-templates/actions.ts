"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { createTemplateSchema } from "@/lib/validations/document-template";
import { writeAuditLog } from "@/lib/audit";
import { validateUploadedFile, generateStorageKey, uploadPrivateFile } from "@/lib/storage";
import { detectPlaceholders, TemplateEngineError } from "@/lib/documents/template-engine";
import { RESOLVER_REGISTRY } from "@/lib/documents/entity-data-resolvers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function readAndValidateDocx(formData: FormData): Promise<{ buffer: Buffer; originalFilename: string; mimeType: string; sizeBytes: number }> {
  const file = formData.get("templateFile");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("templateFileRequired");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const { mime } = await validateUploadedFile(buffer);
  if (mime !== DOCX_MIME) {
    throw new Error("templateMustBeDocx");
  }
  return { buffer, originalFilename: file.name, mimeType: mime, sizeBytes: buffer.byteLength };
}

export async function createTemplateAction(formData: FormData) {
  const user = await requirePermission("templates.manage");
  const raw = Object.fromEntries(formData.entries());
  const parsed = createTemplateSchema.parse(raw);
  const { buffer, originalFilename, mimeType, sizeBytes } = await readAndValidateDocx(formData);

  let detectedFields: string[];
  try {
    detectedFields = detectPlaceholders(buffer);
  } catch (e) {
    throw e instanceof TemplateEngineError ? e : new Error("templateReadFailed");
  }

  const key = generateStorageKey("templates", "docx");
  await uploadPrivateFile({ key, buffer, mimeType });

  const template = await db.documentTemplate.create({
    data: {
      name: parsed.name,
      type: parsed.type,
      language: parsed.language,
      createdById: user.id,
      versions: {
        create: {
          versionNumber: 1,
          status: "DRAFT",
          storageKey: key,
          originalFilename,
          mimeType,
          sizeBytes,
          detectedFields,
          createdById: user.id
        }
      }
    },
    include: { versions: true }
  });

  await writeAuditLog({
    userId: user.id,
    action: "template.create",
    entityType: "DocumentTemplate",
    entityId: template.id,
    changes: { after: { name: parsed.name, type: parsed.type, detectedFields } }
  });
  revalidatePath("/[locale]/dashboard/document-templates", "page");
  const firstVersion = template.versions[0];
  if (!firstVersion) throw new Error("templateVersionMissing"); // unreachable: the nested create above always yields version 1
  return { id: template.id, versionId: firstVersion.id };
}

export async function addTemplateVersionAction(templateId: string, formData: FormData) {
  const user = await requirePermission("templates.manage");
  const { buffer, originalFilename, mimeType, sizeBytes } = await readAndValidateDocx(formData);

  let detectedFields: string[];
  try {
    detectedFields = detectPlaceholders(buffer);
  } catch (e) {
    throw e instanceof TemplateEngineError ? e : new Error("templateReadFailed");
  }

  const key = generateStorageKey("templates", "docx");
  await uploadPrivateFile({ key, buffer, mimeType });

  const maxVersion = await db.documentTemplateVersion.aggregate({ where: { templateId }, _max: { versionNumber: true } });
  const versionNumber = (maxVersion._max.versionNumber ?? 0) + 1;

  const version = await db.documentTemplateVersion.create({
    data: { templateId, versionNumber, status: "DRAFT", storageKey: key, originalFilename, mimeType, sizeBytes, detectedFields, createdById: user.id }
  });

  await writeAuditLog({
    userId: user.id,
    action: "template.version_create",
    entityType: "DocumentTemplateVersion",
    entityId: version.id,
    changes: { after: { templateId, versionNumber, detectedFields } }
  });
  revalidatePath(`/[locale]/dashboard/document-templates/${templateId}`, "page");
  return { id: version.id };
}

// Saves the field mapping for every detected placeholder in one pass, and
// optionally activates the version. Activation requires ALL of:
//  - every detected placeholder has exactly one mapping (Map-keyed by
//    placeholder below, so a malformed submission can't create duplicates)
//  - no unknown placeholders are persisted (anything not in
//    version.detectedFields is silently dropped, never written)
//  - every mapping has a non-empty label
//  - every DATABASE_FIELD mapping has a non-empty sourcePath that is
//    actually one of the resolver's known paths for this template's type
//    (not just "some string was typed")
// Partial/imperfect mappings can still be SAVED as a draft — only
// activation is gated, matching spec: work must persist even before it's
// production-ready.
export async function updateFieldMappingsAction(locale: string, versionId: string, formData: FormData) {
  const user = await requirePermission("templates.manage");
  const version = await db.documentTemplateVersion.findUniqueOrThrow({ where: { id: versionId }, include: { template: true } });

  const placeholders = formData.getAll("placeholder").map(String);
  const labels = formData.getAll("label").map(String);
  const sourceTypes = formData.getAll("sourceType").map(String);
  const sourcePaths = formData.getAll("sourcePath").map(String);
  const shouldActivate = formData.get("activate") === "on";

  const detectedSet = new Set(version.detectedFields);
  const validSourceTypes = new Set(["DATABASE_FIELD", "MANUAL_INPUT", "AI_ASSISTED"]);
  const byPlaceholder = new Map<string, { placeholder: string; label: string; sourceType: "DATABASE_FIELD" | "MANUAL_INPUT" | "AI_ASSISTED"; sourcePath: string | null }>();

  placeholders.forEach((placeholder, i) => {
    if (!detectedSet.has(placeholder)) return; // unknown placeholder for this version — never persisted
    const sourceType = sourceTypes[i];
    if (!sourceType || !validSourceTypes.has(sourceType)) return;
    // Map keying by placeholder means a second submitted row for the same
    // placeholder simply overwrites the first — no duplicate rows possible.
    byPlaceholder.set(placeholder, {
      placeholder,
      label: (labels[i] || placeholder).trim(),
      sourceType: sourceType as "DATABASE_FIELD" | "MANUAL_INPUT" | "AI_ASSISTED",
      sourcePath: sourceType === "DATABASE_FIELD" ? sourcePaths[i] || null : null
    });
  });
  const mappings = Array.from(byPlaceholder.values());

  const resolver = RESOLVER_REGISTRY[version.template.type];
  const validPaths = new Set(resolver?.availablePaths ?? []);

  const isFullyValid = version.detectedFields.every((field) => {
    const m = byPlaceholder.get(field);
    if (!m || !m.label) return false;
    if (m.sourceType === "DATABASE_FIELD") {
      return Boolean(resolver) && Boolean(m.sourcePath) && validPaths.has(m.sourcePath!);
    }
    return true; // MANUAL_INPUT / AI_ASSISTED just need the label, already checked
  });

  await db.$transaction(async (tx) => {
    await tx.documentFieldMapping.deleteMany({ where: { templateVersionId: versionId } });
    if (mappings.length > 0) {
      await tx.documentFieldMapping.createMany({ data: mappings.map((m) => ({ ...m, templateVersionId: versionId })) });
    }

    if (shouldActivate && isFullyValid) {
      await tx.documentTemplateVersion.updateMany({
        where: { templateId: version.templateId, status: "ACTIVE" },
        data: { status: "ARCHIVED" }
      });
      await tx.documentTemplateVersion.update({ where: { id: versionId }, data: { status: "ACTIVE" } });
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "template.mapping_update",
    entityType: "DocumentTemplateVersion",
    entityId: versionId,
    changes: { after: { mappings, activated: shouldActivate && isFullyValid } }
  });
  revalidatePath(`/[locale]/dashboard/document-templates/${version.templateId}`, "page");

  const notice = shouldActivate ? (isFullyValid ? "activated" : "errors.activationBlocked") : "mappingSaved";
  redirect(`/${locale}/dashboard/document-templates/${version.templateId}/versions/${versionId}?notice=${notice}`);
}

export async function archiveTemplateVersionAction(versionId: string) {
  const user = await requirePermission("templates.manage");
  const version = await db.documentTemplateVersion.update({ where: { id: versionId }, data: { status: "ARCHIVED" } });

  await writeAuditLog({ userId: user.id, action: "template.version_archive", entityType: "DocumentTemplateVersion", entityId: versionId });
  revalidatePath(`/[locale]/dashboard/document-templates/${version.templateId}`, "page");
}
