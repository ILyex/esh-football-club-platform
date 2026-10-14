import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { improveFieldAction, generateDocumentAction } from "../../actions";
import { RESOLVER_REGISTRY, applyMappings, requireResolverPermission, resolveBundleOrNotice } from "@/lib/documents/entity-data-resolvers";
import { NoticeToast } from "@/components/shared/notice-toast";
import { isAIConfigured } from "@/lib/ai/document-ai-service";
import { getCurrentTeamId } from "@/lib/team-context";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default async function GenerateFromVersionPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; versionId: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { locale, versionId } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("documents.generate", locale);
  const t = await getTranslations("generatedDocuments");
  const tCommon = await getTranslations("common");

  const version = await db.documentTemplateVersion.findUnique({
    where: { id: versionId },
    include: { template: true, fieldMappings: true }
  });
  const resolver = version ? RESOLVER_REGISTRY[version.template.type] : undefined;
  if (!version || version.status !== "ACTIVE" || !resolver) notFound();
  // Per-entity-type authorization (financial documents need finance.approve
  // in addition to documents.generate) — checked before ANY entity data is read.
  requireResolverPermission(user, resolver, "generate");

  const entityId = sp.entityId;
  const documentLanguage = version.template.language === "ar" ? "ar" : "fr";

  if (!entityId) {
    // Narrowed to the active Team Switcher context where the resolver's
    // entity has a team relationship — "All Teams" (no cookie set) still
    // lists everything, since cross-team document generation is legitimate
    // for club-wide roles.
    const currentTeamId = await getCurrentTeamId();
    const options = await resolver.listEntities(currentTeamId ?? undefined);
    return (
      <div className="max-w-xl">
        <NoticeToast notice={sp.notice} />
        <h1 className="mb-4 text-xl font-semibold">{version.template.name}</h1>
        <form method="get" className="rounded-lg border border-border bg-card p-6">
          <label className="mb-1 block text-sm font-medium">{t("selectEntity")}</label>
          <select name="entityId" required className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <Button type="submit">{tCommon("view")}</Button>
        </form>
      </div>
    );
  }

  const resolved = await resolveBundleOrNotice(resolver, entityId, documentLanguage);
  if ("notice" in resolved) {
    return redirect(`/${locale}/dashboard/generated-documents/new/${versionId}?notice=${encodeURIComponent(resolved.notice)}`);
  }
  const bundle = resolved.bundle;
  const databaseMappings = version.fieldMappings.filter((m) => m.sourceType === "DATABASE_FIELD");
  const manualMappings = version.fieldMappings.filter((m) => m.sourceType !== "DATABASE_FIELD");
  const autoFilled = applyMappings(bundle, databaseMappings, {});
  // Financial document types opt out of AI entirely (registry: aiAssistAllowed false).
  const aiAllowedForType = resolver.aiAssistAllowed !== false;
  const aiAvailable = aiAllowedForType && isAIConfigured();

  async function improve(placeholder: string, formData: FormData) {
    "use server";
    await improveFieldAction(locale, versionId, placeholder, formData);
  }
  async function generate(formData: FormData) {
    "use server";
    await generateDocumentAction(locale, versionId, formData);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{version.template.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === "ar"
              ? "قم بمراجعة أو تخصيص البيانات والمبالغ المستخرجة ثم اضغط توليد الوثيقة"
              : "Vérifiez ou personnalisez les données et montants avant la génération"}
          </p>
        </div>
      </div>

      <form action={generate} className="rounded-xl border border-border bg-card p-5 space-y-6 shadow-xs">
        <input type="hidden" name="entityId" value={entityId} />

        {/* Database auto-filled & customizable values */}
        {databaseMappings.length > 0 && (
          <section className="space-y-4">
            <div className="border-b border-border pb-2">
              <h2 className="text-sm font-semibold text-foreground flex items-center justify-between">
                <span>{locale === "ar" ? "بيانات المستند والمبالغ المستخرجة" : "Données du document & montants"}</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {locale === "ar" ? "يمكنك تعديل أي قيمة أو تحديد المبلغ بنفسك" : "Vous pouvez ajuster les montants directement"}
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {databaseMappings.map((m) => {
                const isAmount = m.placeholder.toLowerCase().includes("amount") || m.sourcePath?.toLowerCase().includes("amount");
                const initialVal = sp[`override_${m.placeholder}`] ?? autoFilled[m.placeholder] ?? "";

                return (
                  <div
                    key={m.placeholder}
                    className={`rounded-lg border p-3 transition ${
                      isAmount
                        ? "sm:col-span-2 border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10"
                        : "border-border bg-background/50"
                    }`}
                  >
                    <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-foreground">
                      <span>{m.label}</span>
                      {isAmount && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          {locale === "ar" ? "تحديد المبلغ يدويًا" : "Montant personnalisable"}
                        </span>
                      )}
                    </label>
                    <input
                      name={`override_${m.placeholder}`}
                      defaultValue={initialVal}
                      placeholder={autoFilled[m.placeholder] || "—"}
                      className={`w-full rounded-md border bg-background px-3 py-2 text-xs font-mono transition focus:outline-hidden ${
                        isAmount
                          ? "border-amber-500/40 text-sm font-bold focus:border-amber-500"
                          : "border-border focus:border-club-primary"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Manual inputs & AI assisted fields */}
        {manualMappings.length > 0 && (
          <section className="space-y-4 border-t border-border pt-4">
            <h2 className="text-sm font-semibold text-foreground">{t("manualFields")}</h2>
            {aiAllowedForType && !aiAvailable && manualMappings.some((m) => m.sourceType === "AI_ASSISTED") && (
              <p className="text-xs text-muted-foreground">{t("aiUnavailable")}</p>
            )}
            {sp.aiFallback && (
              <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                {locale === "ar"
                  ? sp.aiFallback === "quota" ? "انتهت حصة الذكاء الاصطناعي اليوم؛ أبقينا النص كما أدخلته ويمكنك متابعة إنشاء الوثيقة." : "تعذر الوصول إلى الذكاء الاصطناعي؛ أبقينا النص كما أدخلته ويمكنك متابعة إنشاء الوثيقة."
                  : sp.aiFallback === "quota" ? "Le quota quotidien de l’IA est épuisé ; le texte original est conservé et vous pouvez continuer." : "L’IA est indisponible ; le texte original est conservé et vous pouvez continuer."}
              </p>
            )}
            <div className="space-y-4">
              {manualMappings.map((m) => (
                <div key={m.placeholder}>
                  <label className="mb-1 block text-sm font-medium">{m.label}</label>
                  <textarea
                    name={`field_${m.placeholder}`}
                    rows={3}
                    defaultValue={sp[`field_${m.placeholder}`] ?? ""}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  {/* Carries forward whether AI already touched this field across
                      round trips -- read server-side in generateDocumentAction to
                      compute the document's real aiUsed flag. */}
                  <input type="hidden" name={`ai_${m.placeholder}`} value={sp[`ai_${m.placeholder}`] === "1" ? "1" : ""} />
                  {m.sourceType === "AI_ASSISTED" && aiAvailable && (
                    <button type="submit" formAction={improve.bind(null, m.placeholder)} className="mt-1 text-xs text-club-primary underline inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      <span>{t("aiAssist")}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="pt-2">
          <Button type="submit" className="w-full sm:w-auto px-6">
            {t("generate")}
          </Button>
        </div>
      </form>
    </div>
  );
}
