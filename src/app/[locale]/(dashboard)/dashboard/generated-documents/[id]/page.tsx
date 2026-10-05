import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import Link from "next/link";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { readPermissionForEntityType, LABELLED_ENTITY_TYPES, resolveSourceEntityScope } from "@/lib/documents/entity-data-resolvers";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { getPrivateFileBuffer } from "@/lib/storage";
import { isPdfConverterConfigured } from "@/lib/documents/pdf-converter";
import { DocumentViewer } from "@/components/documents/document-viewer";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export default async function GeneratedDocumentDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requirePermission("documents.generate");
  const t = await getTranslations("generatedDocuments");
  const tTemplates = await getTranslations("templates");

  const generated = await db.generatedDocument.findUnique({
    where: { id },
    include: { templateVersion: { include: { template: true } }, createdBy: true }
  });
  if (!generated) notFound();

  // A generated document inherits the read permission of the entity it was
  // generated from: a financial document's inputData (amounts, references,
  // payees) is as sensitive as the expense/ledger entry itself, so changing
  // this id in the URL must not open it for someone without finance access.
  const entityReadPermission = readPermissionForEntityType(generated.relatedEntityType);
  if (entityReadPermission) await requirePermission(entityReadPermission);

  // Authoritative team-scope check: resolve source entity scope
  const sourceScope = await resolveSourceEntityScope(generated.relatedEntityType, generated.relatedEntityId);
  const scopeContext = await getMutationScopeContext();

  if (!sourceScope.exists) {
    // If source no longer exists, fail-closed for restricted users
    if (!scopeContext.isUnrestricted) {
      notFound();
    }
  } else {
    try {
      assertTeamScope(scopeContext, sourceScope.teamId, "GeneratedDocument", { allowClubWide: true });
    } catch {
      notFound();
    }
  }

  // Load generated DOCX file buffer server-side
  let initialDocxBase64 = "";
  try {
    const docxBuffer = await getPrivateFileBuffer(generated.storageKey);
    initialDocxBase64 = docxBuffer.toString("base64");
  } catch (err) {
    console.error("Failed to load generated document file:", err);
  }

  const isPdfConfigured = isPdfConverterConfigured();
  const inputData = generated.inputData as Record<string, string>;

  // Link back to originating entity if user has permissions
  let entityHref: string | null = null;
  if (generated.relatedEntityId && hasPermission(user, "finance.view")) {
    if (generated.relatedEntityType === "Expense") {
      entityHref = `/${locale}/dashboard/finance/expenses/${generated.relatedEntityId}`;
    } else if (generated.relatedEntityType === "TreasuryTransaction") {
      const tx = await db.treasuryTransaction.findUnique({ where: { id: generated.relatedEntityId }, select: { id: true, treasuryAccountId: true } });
      if (tx) entityHref = `/${locale}/dashboard/finance/treasury/${tx.treasuryAccountId}/transactions/${tx.id}`;
    }
  }
  const entityTypeLabel = generated.relatedEntityType ? (LABELLED_ENTITY_TYPES.includes(generated.relatedEntityType) ? t(`entityTypes.${generated.relatedEntityType}` as any) : generated.relatedEntityType) : "—";

  const viewerLabels = {
    print: t("print"),
    downloadDocx: t("downloadDocx"),
    downloadPdf: t("downloadPdf"),
    serverPdfUnavailable: t("serverPdfUnavailable"),
    previewLoading: t("previewLoading"),
    previewError: t("previewError"),
    printInstruction: t("printInstruction"),
    zoomIn: t("zoomIn"),
    zoomOut: t("zoomOut"),
    resetZoom: t("resetZoom"),
    a4Sheet: t("a4Sheet")
  };

  return (
    <div className="space-y-6">
      {/* Header and metadata summary — hidden during printing */}
      <div className="rounded-lg border border-border bg-card p-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{generated.templateVersion.template.name}</h1>
              {generated.aiUsed && <Badge tone="neutral">AI</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {tTemplates(`types.${generated.templateVersion.template.type}` as any)} • v{generated.templateVersion.versionNumber}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div>
              <span className="font-semibold text-foreground">{t("fields.createdBy")}: </span>
              {generated.createdBy.name}
            </div>
            <div>
              <span className="font-semibold text-foreground">{t("fields.createdAt")}: </span>
              {new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(generated.createdAt)}
            </div>
            <div>
              <span className="font-semibold text-foreground">{t("fields.relatedEntity")}: </span>
              {entityHref ? (
                <Link href={entityHref} className="text-club-primary underline">
                  {entityTypeLabel}
                </Link>
              ) : (
                <span>{entityTypeLabel}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Visual Document Preview, Print & Export Section */}
      <section aria-label={t("preview")}>
        <DocumentViewer
          initialDocxBase64={initialDocxBase64}
          documentId={generated.id}
          filename={generated.templateVersion.template.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_") || generated.id}
          locale={locale}
          isPdfConfigured={isPdfConfigured}
          labels={viewerLabels}
        />
      </section>

      {/* Collapsible raw data details for audit & verification — hidden during printing */}
      <details className="rounded-lg border border-border bg-card p-4 text-sm print:hidden">
        <summary className="cursor-pointer font-semibold text-foreground hover:text-club-primary">
          {t("metadata")} ({Object.keys(inputData).length} {t("fields.template")})
        </summary>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          {Object.entries(inputData).map(([k, v]) => (
            <div key={k} className="rounded bg-muted/40 p-2">
              <dt className="font-mono text-muted-foreground">{k}</dt>
              <dd className="mt-1 font-medium">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
