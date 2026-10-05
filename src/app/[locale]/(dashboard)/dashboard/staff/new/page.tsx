import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/permissions";
import { createStaffAction } from "../actions";
import { NewStaffForm } from "@/components/staff/new-staff-form";

const ROLES = [
  "HEAD_COACH",
  "ASSISTANT_COACH",
  "GOALKEEPING_COACH",
  "FITNESS_COACH",
  "MEDICAL_STAFF",
  "ADMINISTRATIVE_STAFF",
  "OTHER"
] as const;

export default async function NewStaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePermission("staff.create");
  const t = await getTranslations("staff");
  const tCommon = await getTranslations("common");

  const roleTranslations: Record<string, string> = {};
  for (const r of ROLES) {
    roleTranslations[r] = t(`roles.${r}` as any);
  }

  const isAr = locale === "ar";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">{t("addStaff")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAr
            ? "إضافة وتسجيل عضو جديد في الطاقم وتوثيق هويته بالعربية والفرنسية ومستنداته الرسمية وفحص المخدرات"
            : "Enregistrer un nouveau membre du staff avec son identité bilingue, ses pièces justificatives et dépistage"}
        </p>
      </div>

      <NewStaffForm
        locale={locale}
        createAction={createStaffAction}
        roleTranslations={roleTranslations}
        commonSave={tCommon("save")}
      />
    </div>
  );
}
