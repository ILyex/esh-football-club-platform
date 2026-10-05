import { Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/permissions";
import { createTemplateAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

const TYPES = [
  "MATCH_REPORT",
  "MEETING_MINUTES",
  "CORRESPONDENCE",
  "ANNOUNCEMENT",
  "PLAYER_REPORT",
  "TRAINING_REPORT",
  "ADMINISTRATIVE_REPORT",
  "EXPENSE_STATEMENT",
  "DEPOSIT_RECEIPT",
  "WITHDRAWAL_RECEIPT",
  "OTHER"
] as const;

export default async function NewDocumentTemplatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePermission("templates.manage");
  const t = await getTranslations("templates");
  const tCommon = await getTranslations("common");

  async function action(formData: FormData) {
    "use server";
    const { id, versionId } = await createTemplateAction(formData);
    redirect(`/${locale}/dashboard/document-templates/${id}/versions/${versionId}`);
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-xl font-semibold">{t("addTemplate")}</h1>
      <form action={action} className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.name")}</label>
          <input name="name" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.type")}</label>
          <select name="type" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`types.${ty}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.language")}</label>
          <select name="language" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="ar">العربية</option>
            <option value="fr">Français</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.file")}</label>
          <input
            name="templateFile"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required
            className="w-full text-sm"
          />
        </div>
        <div className="col-span-2">
          <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
        </div>
      </form>
    </div>
  );
}
