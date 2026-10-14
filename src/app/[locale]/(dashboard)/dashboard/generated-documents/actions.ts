"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { redirect } from "next/navigation";
import { generateStorageKey, uploadPrivateFile, getPrivateFileBuffer, deletePrivateFile, StorageConfigurationError } from "@/lib/storage";
import { renderTemplate } from "@/lib/documents/template-engine";
import {
  RESOLVER_REGISTRY,
  applyMappings,
  requireResolverPermission,
  resolveBundleOrNotice,
  resolveSourceEntityScope,
  type DocumentLanguage
} from "@/lib/documents/entity-data-resolvers";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { isAIConfigured, formalizeTextWithStatus } from "@/lib/ai/document-ai-service";

function documentLanguage(language: string): DocumentLanguage {
  return language === "ar" ? "ar" : "fr";
}

// The generation form has no client-side state (this app deliberately has
// no client JS on these pages -- see the rest of the dashboard), so a value
// typed into one field must survive a full-page round trip whenever another
// field's "AI improve" button is pressed. Every action below reads every
// MANUAL_INPUT/AI_ASSISTED field's *current* value from the submitted form
// (a <button formAction=...> still submits the whole enclosing form) and
// re-encodes all of them into the redirect URL, so nothing the user already
// typed is ever silently lost. Each field also carries an `ai_<placeholder>`
// flag alongside its `field_<placeholder>` value -- this is what makes
// aiUsed on the final GeneratedDocument row TRUE only when AI was actually
// invoked for THIS generation, not merely because the template happens to
// have an AI_ASSISTED field mapped.
function collectFieldState(formData: FormData, placeholders: string[]): { values: Record<string, string>; aiTouched: Record<string, boolean> } {
  const values: Record<string, string> = {};
  const aiTouched: Record<string, boolean> = {};
  for (const p of placeholders) {
    const v = formData.get(`field_${p}`);
    if (typeof v === "string") values[p] = v;
    aiTouched[p] = formData.get(`ai_${p}`) === "1";
  }
  return { values, aiTouched };
}

function buildQueryString(entityId: string, values: Record<string, string>, aiTouched: Record<string, boolean>): string {
  const params = new URLSearchParams({ entityId });
  for (const [k, v] of Object.entries(values)) {
    if (v) params.set(`field_${k}`, v);
  }
  for (const [k, touched] of Object.entries(aiTouched)) {
    if (touched) params.set(`ai_${k}`, "1");
  }
  return params.toString();
}

export async function improveFieldAction(locale: string, versionId: string, targetPlaceholder: string, formData: FormData) {
  const user = await requirePermission("documents.generate");
  const entityId = String(formData.get("entityId") ?? "");
  const version = await db.documentTemplateVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { template: true, fieldMappings: true }
  });
  const resolver = RESOLVER_REGISTRY[version.template.type];
  if (!resolver) throw new Error("unsupportedType");
  requireResolverPermission(user, resolver, "generate");

  if (entityId) {
    const scopeContext = await getMutationScopeContext();
    const sourceScope = await resolveSourceEntityScope(resolver.entityType, entityId);
    if (sourceScope.exists) {
      assertTeamScope(scopeContext, sourceScope.teamId, resolver.entityType);
    }
  }

  const mappings = version.fieldMappings;
  const manualPlaceholders = mappings.filter((m) => m.sourceType !== "DATABASE_FIELD").map((m) => m.placeholder);

  const { values, aiTouched } = collectFieldState(formData, manualPlaceholders);

  // Financial documents never go through AI (aiAssistAllowed: false in the registry).
  let aiFallback: "quota" | "unavailable" | null = null;
  if (resolver.aiAssistAllowed !== false && isAIConfigured() && values[targetPlaceholder]?.trim()) {
    const result = await formalizeTextWithStatus(values[targetPlaceholder]);
    values[targetPlaceholder] = result.text;
    aiFallback = result.fallback;
    if (!aiFallback) aiTouched[targetPlaceholder] = true; // only mark text that AI actually changed
  }

  const query = new URLSearchParams(buildQueryString(entityId, values, aiTouched));
  if (aiFallback) query.set("aiFallback", aiFallback);
  redirect(`/${locale}/dashboard/generated-documents/new/${versionId}?${query.toString()}`);
}

export async function generateDocumentAction(locale: string, versionId: string, formData: FormData) {
  const user = await requirePermission("documents.generate");
  const entityId = String(formData.get("entityId") ?? "");
  if (!entityId) throw new Error("entityRequired");

  const version = await db.documentTemplateVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { template: true, fieldMappings: true }
  });
  if (version.status !== "ACTIVE") throw new Error("versionNotActive");

  const resolver = RESOLVER_REGISTRY[version.template.type];
  if (!resolver) throw new Error("unsupportedType"); // no data resolver registered for this template type yet
  // Server-side, per-entity-type authorization: documents.generate alone is
  // not enough to read an expense or a ledger entry (see the registry).
  requireResolverPermission(user, resolver, "generate");

  // Server-side team-scope authorization: verify the source entity belongs to actor's authorized UserTeam scope
  const scopeContext = await getMutationScopeContext();
  const sourceScope = await resolveSourceEntityScope(resolver.entityType, entityId);
  if (!sourceScope.exists) throw new Error("entityNotFound");
  assertTeamScope(scopeContext, sourceScope.teamId, resolver.entityType);

  const manualPlaceholders = version.fieldMappings.filter((m) => m.sourceType !== "DATABASE_FIELD").map((m) => m.placeholder);
  const { values: manualValues, aiTouched } = collectFieldState(formData, manualPlaceholders);

  // Also collect any explicit overrides provided by the user (e.g. custom withdrawal/deposit amount determination)
  for (const m of version.fieldMappings) {
    const override = formData.get(`override_${m.placeholder}`);
    if (typeof override === "string" && override.trim().length > 0) {
      manualValues[`override_${m.placeholder}`] = override.trim();
    }
  }

  // TRUE only if the "AI improve" round trip actually ran for at least one
  // field in THIS generation -- never just because an AI_ASSISTED mapping
  // exists on the template. Always false for document types that forbid AI.
  const aiUsed = resolver.aiAssistAllowed !== false && Object.values(aiTouched).some(Boolean);

  // Authoritative values come from the database, never from the form: the
  // bundle is resolved here, on the server, from entityId alone.
  const resolved = await resolveBundleOrNotice(resolver, entityId, documentLanguage(version.template.language));
  if ("notice" in resolved) {
    return redirect(`/${locale}/dashboard/generated-documents/new/${versionId}?notice=${encodeURIComponent(resolved.notice)}`);
  }
  const bundle = resolved.bundle;
  const resolvedData = applyMappings(bundle, version.fieldMappings, manualValues);

  // Fetch the untouched original template file and render a NEW copy -- the
  // stored template itself is never mutated, so it can be reused indefinitely.
  let templateBuffer: Buffer;
  let generatedBuffer: Buffer;
  const key = generateStorageKey("generated", "docx");
  try {
    templateBuffer = await getPrivateFileBuffer(version.storageKey);
    generatedBuffer = renderTemplate(templateBuffer, resolvedData);
    await uploadPrivateFile({ key, buffer: generatedBuffer, mimeType: version.mimeType });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return redirect(`/${locale}/dashboard/generated-documents/new/${versionId}?notice=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  // The GeneratedDocument row and its mandatory audit record(s) commit
  // together. The private file is uploaded first (object storage cannot join a
  // database transaction); if the database part fails, the just-uploaded file
  // is removed so no orphan is left behind.
  let generated;
  try {
    generated = await db.$transaction(async (tx) => {
      const created = await tx.generatedDocument.create({
        data: {
          templateVersionId: versionId,
          relatedEntityType: resolver.entityType,
          relatedEntityId: entityId,
          inputData: resolvedData,
          aiUsed,
          storageKey: key,
          mimeType: version.mimeType,
          sizeBytes: generatedBuffer.byteLength,
          createdById: user.id
        }
      });

      await writeAuditLog(
        {
          userId: user.id,
          action: "document.generate",
          entityType: "GeneratedDocument",
          entityId: created.id,
          changes: { after: { templateVersionId: versionId, relatedEntityType: resolver.entityType, relatedEntityId: entityId, aiUsed } }
        },
        tx
      );

      // For financial documents the originating Expense/TreasuryTransaction
      // also gets its own audit entry, so its history shows that an official
      // document was issued from it. (The GeneratedDocument row itself links
      // back via relatedEntityType/relatedEntityId — that is the
      // document<->entity link.)
      if (resolver.auditOnEntity) {
        await writeAuditLog(
          {
            userId: user.id,
            action: `${resolver.entityType === "Expense" ? "expense" : "treasury"}.document_generated`,
            entityType: resolver.entityType,
            entityId,
            changes: { after: { generatedDocumentId: created.id, templateVersionId: versionId } }
          },
          tx
        );
      }
      return created;
    });
  } catch (error) {
    await deletePrivateFile(key).catch(() => undefined);
    throw error;
  }

  redirect(`/${locale}/dashboard/generated-documents/${generated.id}`);
}
