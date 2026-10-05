import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { updateClubSettingsAction } from "./actions";
import { SettingsNavTabs } from "@/components/settings/settings-nav-tabs";
import { ClubSettingsForm } from "@/components/settings/club-settings-form";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePermission("settings.manage");
  const isAr = locale === "ar";

  const settings = await db.clubSettings.findUniqueOrThrow({ where: { id: "singleton" } });

  async function save(formData: FormData) {
    "use server";
    return await updateClubSettingsAction(formData);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4">
      <SettingsNavTabs locale={locale} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {isAr ? "إعدادات النادي والهوية المؤسسية" : "Paramètres du club & Identité"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isAr
              ? "تخصيص الهوية الرسمية، الشعار، الألوان المعتمدة، المقر الاجتماعي، وتدقيق حوكمة نادي أمل سيدي حسني"
              : "Configuration de l'identité officielle, du blason, des couleurs et des coordonnées du club"}
          </p>
        </div>
      </div>

      <ClubSettingsForm locale={locale} settings={settings} action={save} />
    </div>
  );
}
