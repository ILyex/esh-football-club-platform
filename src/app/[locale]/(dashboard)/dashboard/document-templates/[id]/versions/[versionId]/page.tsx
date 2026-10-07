import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { updateFieldMappingsAction } from "../../../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NoticeToast } from "@/components/shared/notice-toast";
import { RESOLVER_REGISTRY } from "@/lib/documents/entity-data-resolvers";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "warning",
  ACTIVE: "success",
  ARCHIVED: "neutral"
};

export default async function FieldMappingPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; id: string; versionId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { locale, versionId } = await params;
  const { notice } = await searchParams;
  await requirePagePermission("templates.manage", locale);
  const t = await getTranslations("templates");
  const tCommon = await getTranslations("common");

  const version = await db.documentTemplateVersion.findUnique({
    where: { id: versionId },
    include: { template: true, fieldMappings: true }
  });
  if (!version) notFound();

  const mappingByPlaceholder = new Map(version.fieldMappings.map((m) => [m.placeholder, m] as const));
  const resolver = RESOLVER_REGISTRY[version.template.type];
  const availablePaths = resolver?.availablePaths ?? [];

  async function save(formData: FormData) {
    "use server";
    await updateFieldMappingsAction(locale, versionId, formData);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <NoticeToast notice={notice} />
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">
          {version.template.name} — v{version.versionNumber}
        </h1>
        <Badge tone={STATUS_TONE[version.status]}>{t(`versionStatuses.${version.status}` as any)}</Badge>
      </div>

      {!resolver && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {tCommon("noResults")}
        </p>
      )}

      {version.detectedFields.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">{t("noFieldsDetected")}</p>
      ) : (
        <form action={save} className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold">{t("mapping.title")}</h2>
          <div className="space-y-4">
            {version.detectedFields.map((placeholder) => {
              const existing = mappingByPlaceholder.get(placeholder);
              return (
                <div key={placeholder} className="grid grid-cols-4 gap-2 rounded-md border border-border p-3">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{t("mapping.placeholder")}</p>
                    <input type="hidden" name="placeholder" value={placeholder} />
                    <p className="rounded bg-muted px-2 py-1.5 font-mono text-xs">{`{{${placeholder}}}`}</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("mapping.label")}</label>
                    <input
                      name="label"
                      defaultValue={existing?.label ?? placeholder}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("mapping.sourceType")}</label>
                    <select name="sourceType" defaultValue={existing?.sourceType ?? "MANUAL_INPUT"} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm">
                      <option value="DATABASE_FIELD">{t("sourceTypes.DATABASE_FIELD")}</option>
                      <option value="MANUAL_INPUT">{t("sourceTypes.MANUAL_INPUT")}</option>
                      <option value="AI_ASSISTED">{t("sourceTypes.AI_ASSISTED")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("mapping.sourcePath")}</label>
                    {availablePaths.length > 0 ? (
                      <select name="sourcePath" defaultValue={existing?.sourcePath ?? ""} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm">
                        <option value="">—</option>
                        {availablePaths.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name="sourcePath"
                        defaultValue={existing?.sourcePath ?? ""}
                        placeholder="e.g. match.homeTeamName"
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input name="activate" type="checkbox" defaultChecked={version.status !== "ACTIVE"} />
            {t("mapping.activate")}
          </label>
          <p className="mb-4 text-xs text-muted-foreground">{t("mapping.activateHint")}</p>

          <Button type="submit">{t("mapping.save")}</Button>
        </form>
      )}
    </div>
  );
}
