import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { addTemplateVersionAction } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "warning",
  ACTIVE: "success",
  ARCHIVED: "neutral"
};

export default async function DocumentTemplateDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requirePagePermission("templates.manage", locale);
  const t = await getTranslations("templates");
  const tCommon = await getTranslations("common");

  const template = await db.documentTemplate.findUnique({ where: { id }, include: { versions: { orderBy: { versionNumber: "desc" } } } });
  if (!template) notFound();

  async function addVersion(formData: FormData) {
    "use server";
    const { id: versionId } = await addTemplateVersionAction(id, formData);
    redirect(`/${locale}/dashboard/document-templates/${id}/versions/${versionId}`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{template.name}</h1>
        <p className="text-sm text-muted-foreground">{t(`types.${template.type}` as any)}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">{tCommon("view")}</h2>
        <ul className="divide-y divide-border">
          {template.versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                v{v.versionNumber} — {v.originalFilename} • {v.detectedFields.length} {t("detectedFields")}
              </span>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[v.status]}>{t(`versionStatuses.${v.status}` as any)}</Badge>
                <Link href={`/${locale}/dashboard/document-templates/${id}/versions/${v.id}`} className="text-club-primary underline">
                  {tCommon("edit")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <form action={addVersion} className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold">{t("addVersion")}</h2>
        <input
          name="templateFile"
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          className="mb-3 w-full text-sm"
        />
        <Button type="submit" variant="outline">
          {t("addVersion")}
        </Button>
      </form>
    </div>
  );
}
