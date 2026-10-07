import { Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { hasPermission, requirePagePermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentsNavTabs } from "@/components/documents/documents-nav-tabs";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "warning",
  ACTIVE: "success",
  ARCHIVED: "neutral"
};

export default async function DocumentTemplatesListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requirePagePermission("templates.view", locale);
  const t = await getTranslations("templates");
  const tCommon = await getTranslations("common");
  const canManageTemplates = hasPermission(user, "templates.manage");

  const templates = await db.documentTemplate.findMany({
    include: { versions: { orderBy: { versionNumber: "desc" } } },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-5">
      <DocumentsNavTabs
        locale={locale}
        canViewDocuments={hasPermission(user, "documents.view")}
        canViewContracts={hasPermission(user, "contracts.view")}
        canViewInsurance={hasPermission(user, "documents.view")}
        canViewCorrespondence={hasPermission(user, "correspondence.view")}
        canViewMeetings={hasPermission(user, "meetings.view")}
        canViewTemplates={true}
        canManageTemplates={hasPermission(user, "templates.manage")}
        canViewReports={hasPermission(user, "reports.view")}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {locale === "ar"
              ? "قوالب Word تُستخدم لإنشاء وثائق النادي مع تعبئة بيانات السجلات تلقائياً. لا يصبح القالب متاحاً للتوليد حتى تفعيل أحد إصداراته؛ وتُستخدم القوالب النشطة أيضاً لإيصالات الصندوق والمصاريف."
              : "Les modèles Word servent à générer les documents du club en préremplissant les données des dossiers. Un modèle n'est disponible qu'après activation d'une version ; les modèles actifs servent aussi aux reçus de trésorerie et de dépenses."}
          </p>
        </div>
        {canManageTemplates && (
          <Link href={`/${locale}/dashboard/document-templates/new`} className="shrink-0">
            <Button className="inline-flex items-center gap-2"><Plus className="h-4 w-4 shrink-0" aria-hidden="true" />{t("addTemplate")}</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((tpl) => {
          const activeVersion = tpl.versions.find((v) => v.status === "ACTIVE");
          const latestVersion = tpl.versions[0];
          const displayedStatus = activeVersion?.status ?? latestVersion?.status ?? "DRAFT";
          const card = (
            <>
              <div className="mb-2 flex min-w-0 items-start justify-between gap-3">
                <h2 className="min-w-0 truncate font-semibold group-hover:text-club-primary">{tpl.name}</h2>
                <Badge tone={STATUS_TONE[displayedStatus]}>
                  {t(`versionStatuses.${displayedStatus}` as any)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t(`types.${tpl.type}` as any)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                <span>{locale === "ar" ? `الإصدار ${latestVersion?.versionNumber ?? 0}` : `Version ${latestVersion?.versionNumber ?? 0}`}</span>
                <span>{locale === "ar" ? `اللغة: ${tpl.language.toUpperCase()}` : `Langue : ${tpl.language.toUpperCase()}`}</span>
                <span>{locale === "ar" ? `${tpl.versions.length} إصدارات` : `${tpl.versions.length} version(s)`}</span>
              </div>
              {!activeVersion && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  {locale === "ar" ? "غير متاح للتوليد حتى تفعيل إصدار." : "Indisponible pour la génération avant l'activation d'une version."}
                </p>
              )}
            </>
          );
          return canManageTemplates ? (
            <Link key={tpl.id} href={`/${locale}/dashboard/document-templates/${tpl.id}`} className="group block min-w-0 rounded-xl border border-border bg-card p-4 transition-colors hover:border-club-primary/50 hover:bg-muted/20">
              {card}
            </Link>
          ) : (
            <div key={tpl.id} className="block min-w-0 rounded-xl border border-border bg-card p-4">
              {card}
            </div>
          );
        })}
        {templates.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card/50 px-5 py-8 text-center">
            <p className="font-medium">{tCommon("noResults")}</p>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
              {locale === "ar"
                ? "أضف قالب Word ثم عيّن حقوله وفعّل الإصدار ليظهر في إنشاء الوثائق والإيصالات."
                : "Ajoutez un modèle Word, configurez ses champs et activez une version pour l'utiliser dans les documents et les reçus."}
            </p>
            {canManageTemplates && (
              <Link href={`/${locale}/dashboard/document-templates/new`} className="mt-4 inline-flex">
                <Button className="inline-flex items-center gap-2"><Plus className="h-4 w-4 shrink-0" aria-hidden="true" />{t("addTemplate")}</Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
