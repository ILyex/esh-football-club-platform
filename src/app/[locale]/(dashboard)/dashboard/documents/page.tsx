import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { DashboardTeamCategorySelect } from "@/components/shared/dashboard-team-category-select";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentsNavTabs } from "@/components/documents/documents-nav-tabs";
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal";
import { localizedClubName } from "@/lib/public/locale-text";
import {
  FileText,
  Download,
  ArrowRight,
  FileCheck,
  Layers,
  FolderArchive,
  Trophy,
  Users,
  UserCheck,
  Building2,
  Calendar,
  CheckCircle2,
  Filter,
  Eye
} from "lucide-react";

const CLASSIFICATION_TONE = { PUBLIC: "success", INTERNAL: "neutral", RESTRICTED: "danger" } as const;

const DOCUMENT_CATEGORY_LABELS: Record<string, { ar: string; fr: string }> = {
  contract: { ar: "العقود", fr: "Contrats" },
  administrative: { ar: "وثائق إدارية", fr: "Documents administratifs" },
  registration: { ar: "وثائق التسجيل", fr: "Documents d’inscription" },
  correspondence: { ar: "المراسلات والطعون", fr: "Correspondances et recours" },
  meeting_minute: { ar: "محاضر الاجتماعات", fr: "Procès-verbaux" },
  report: { ar: "التقارير", fr: "Rapports" },
  calendar: { ar: "الجداول الزمنية", fr: "Calendriers" },
  decision: { ar: "القرارات الرسمية", fr: "Décisions officielles" },
  certificate: { ar: "الشهادات", fr: "Certificats" },
  other: { ar: "وثائق أخرى", fr: "Autres documents" }
};

export default async function DocumentsListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string; category?: string; filter?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("documents.view", locale);
  const t = await getTranslations("documents");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const canSeeRestricted = hasPermission(user, "documents.view.restricted");
  const canViewContracts = hasPermission(user, "contracts.view");
  const canViewCorrespondence = hasPermission(user, "correspondence.view");
  const canViewMeetings = hasPermission(user, "meetings.view");
  const effectiveTeamId = await getEffectiveTeamId(sp.team);

  const activeFilter = sp.filter ?? "all";

  const filterWhere: any = {
    ...(canSeeRestricted ? {} : { classification: { in: ["PUBLIC", "INTERNAL"] } }),
    ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}),
    ...(sp.category ? { categoryId: sp.category } : {})
  };

  if (activeFilter === "matches") {
    filterWhere.relatedMatchId = { not: null };
  } else if (activeFilter === "personnel") {
    filterWhere.OR = [{ relatedPlayerId: { not: null } }, { relatedStaffId: { not: null } }];
  } else if (activeFilter === "official") {
    filterWhere.OR = [
      { category: { key: { in: ["decision", "certificate", "meeting_minute", "report"] } } },
      { correspondenceAttachments: { some: {} } },
      { meetingAttachments: { some: {} } }
    ];
  } else if (activeFilter === "generated") {
    filterWhere.generatedFrom = { isNot: null };
  }

  const [
    documents,
    teams,
    categories,
    totalAllCount,
    matchDocsCount,
    personnelDocsCount,
    officialDocsCount
  ] = await Promise.all([
    db.document.findMany({
      where: filterWhere,
      include: {
        category: true,
        team: true,
        generatedFrom: true,
        relatedMatch: { select: { id: true, homeTeamName: true, awayTeamName: true, isHomeFixture: true, matchDate: true } },
        relatedPlayer: { select: { id: true, firstName: true, lastName: true } },
        relatedStaff: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 60
    }),
    getAuthorizedTeams(),
    db.documentCategory.findMany({ orderBy: { name: "asc" } }),
    db.document.count({
      where: canSeeRestricted ? {} : { classification: { in: ["PUBLIC", "INTERNAL"] } }
    }),
    db.document.count({ where: { relatedMatchId: { not: null } } }),
    db.document.count({ where: { OR: [{ relatedPlayerId: { not: null } }, { relatedStaffId: { not: null } }] } }),
    db.document.count({
      where: {
        OR: [
          { category: { key: { in: ["decision", "certificate", "meeting_minute", "report"] } } },
          { correspondenceAttachments: { some: {} } },
          { meetingAttachments: { some: {} } }
        ]
      }
    })
  ]);

  return (
    <div className="space-y-6">
      <DocumentsNavTabs
        locale={locale}
        canViewDocuments={true}
        canViewContracts={canViewContracts}
        canViewInsurance={true}
        canViewCorrespondence={canViewCorrespondence}
        canViewMeetings={canViewMeetings}
        canViewTemplates={hasPermission(user, "templates.view")}
        canManageTemplates={hasPermission(user, "templates.manage")}
        canViewReports={hasPermission(user, "reports.view")}
      />

      {/* ----------------- Header & Primary Actions ----------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {locale === "ar" ? "أرشيف الوثائق" : "Archives des documents"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === "ar"
              ? "سجل موحّد لوثائق النادي، وملفات اللاعبين، وأوراق المباريات، والمراسلات ومحاضر الاجتماعات الرسمية."
              : "Un registre unique des documents du club, dossiers des joueurs, feuilles de match, correspondances et procès-verbaux officiels."}
          </p>
        </div>
      </div>

      {/* ----------------- Institutional Document Hubs (Clear Real-World Club Value) ----------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Hub 1: Match Sheets & Referee Reports */}
        <Link
          href={`/${locale}/dashboard/documents?filter=matches`}
          className={`group flex flex-col justify-between rounded-xl border p-4 transition-all ${
            activeFilter === "matches"
              ? "border-emerald-500 bg-emerald-500/5 shadow-xs ring-1 ring-emerald-500/20"
              : "border-border bg-card hover:border-emerald-500/60 hover:shadow-xs"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Trophy className="h-5 w-5" />
              </span>
              <Badge tone="success" className="text-[11px] font-mono font-bold">
                {matchDocsCount}
              </Badge>
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-emerald-600 transition-colors">
              {locale === "ar" ? "أوراق التحكيم وتقارير المباريات" : "Feuilles de Matchs & Arbitrage"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "ar"
                ? "تقارير الحكام والرابطة الولائية، استدعاءات المقابلات وقوائم التشكيلة الرسمية"
                : "Rapports des arbitres, convocations et feuilles d'engagement de la ligue"}
            </p>
          </div>
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-3 group-hover:underline inline-flex items-center gap-1">
            {locale === "ar" ? "تصفح أوراق المباريات ←" : "Consulter les matchs ←"}
          </span>
        </Link>

        {/* Hub 2: Player & Staff Dossiers */}
        <Link
          href={`/${locale}/dashboard/documents?filter=personnel`}
          className={`group flex flex-col justify-between rounded-xl border p-4 transition-all ${
            activeFilter === "personnel"
              ? "border-blue-500 bg-blue-500/5 shadow-xs ring-1 ring-blue-500/20"
              : "border-border bg-card hover:border-blue-500/60 hover:shadow-xs"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Users className="h-5 w-5" />
              </span>
              <Badge tone="neutral" className="text-[11px] font-mono font-bold">
                {personnelDocsCount}
              </Badge>
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-blue-600 transition-colors">
              {locale === "ar" ? "ملفات اللاعبين ورخص التأهيل" : "Dossiers Joueurs & Licences"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "ar"
                ? "شهادات الميلاد، الفحوصات الطبية، رخص الرابطة، والملفات الإدارية للاعبين والطاقم"
                : "Certificats médicaux, extraits de naissance et dossiers de qualification"}
            </p>
          </div>
          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 mt-3 group-hover:underline inline-flex items-center gap-1">
            {locale === "ar" ? "عرض ملفات الكوادر ←" : "Consulter les dossiers ←"}
          </span>
        </Link>

        {/* Hub 3: Administrative Correspondence & Official Minutes */}
        <Link
          href={`/${locale}/dashboard/documents?filter=official`}
          className={`group flex flex-col justify-between rounded-xl border p-4 transition-all ${
            activeFilter === "official"
              ? "border-purple-500 bg-purple-500/5 shadow-xs ring-1 ring-purple-500/20"
              : "border-border bg-card hover:border-purple-500/60 hover:shadow-xs"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Building2 className="h-5 w-5" />
              </span>
              <Badge tone="neutral" className="text-[11px] font-mono font-bold">
                {officialDocsCount}
              </Badge>
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-purple-600 transition-colors">
              {locale === "ar" ? "المراسلات ومحاضر الاجتماعات" : "Correspondances et procès-verbaux officiels"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "ar"
                ? "مراسلات النادي وقرارات المكتب المسير ومحاضر الاجتماعات الرسمية."
                : "Courriers officiels, décisions du bureau exécutif et procès-verbaux des réunions."}
            </p>
          </div>
          <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 mt-3 group-hover:underline inline-flex items-center gap-1">
            {locale === "ar" ? "عرض المراسلات والقرارات ←" : "Consulter les PVs ←"}
          </span>
        </Link>
      </div>

      {/* ----------------- Filter Bar & Category Controls ----------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border pb-3">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${locale}/dashboard/documents?${new URLSearchParams({
              ...(sp.team ? { team: sp.team } : {}),
              ...(sp.category ? { category: sp.category } : {})
            })}`}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>{locale === "ar" ? "كافة وثائق الأرشيف" : "Tout l'archive"}</span>
            <span className="rounded-full bg-black/20 px-1.5 py-0.2 text-[10px] font-mono">
              {totalAllCount}
            </span>
          </Link>

          <Link
            href={`/${locale}/dashboard/documents?${new URLSearchParams({
              ...(sp.team ? { team: sp.team } : {}),
              ...(sp.category ? { category: sp.category } : {}),
              filter: "matches"
            })}`}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === "matches"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Trophy className="h-3.5 w-3.5 shrink-0" />
            <span>{locale === "ar" ? "أوراق التحكيم والمباريات" : "Matchs"}</span>
            <span className="rounded-full bg-black/20 px-1.5 py-0.2 text-[10px] font-mono">
              {matchDocsCount}
            </span>
          </Link>

          <Link
            href={`/${locale}/dashboard/documents?${new URLSearchParams({
              ...(sp.team ? { team: sp.team } : {}),
              ...(sp.category ? { category: sp.category } : {}),
              filter: "personnel"
            })}`}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === "personnel"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 shrink-0" />
            <span>{locale === "ar" ? "ملفات ورخص اللاعبين" : "Joueurs & Staff"}</span>
            <span className="rounded-full bg-black/20 px-1.5 py-0.2 text-[10px] font-mono">
              {personnelDocsCount}
            </span>
          </Link>

          <Link
            href={`/${locale}/dashboard/documents?${new URLSearchParams({
              ...(sp.team ? { team: sp.team } : {}),
              ...(sp.category ? { category: sp.category } : {}),
              filter: "official"
            })}`}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === "official"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>{locale === "ar" ? "المراسلات ومحاضر الجلسات" : "PVs & Courriers"}</span>
            <span className="rounded-full bg-black/20 px-1.5 py-0.2 text-[10px] font-mono">
              {officialDocsCount}
            </span>
          </Link>
        </div>

        {/* Dropdown Filters */}
        <form className="dashboard-filter-toolbar">
          {activeFilter !== "all" && <input type="hidden" name="filter" value={activeFilter} />}
          <DashboardTeamCategorySelect
            value={sp.team ?? effectiveTeamId ?? "ALL"}
            options={teams.map((tm) => ({ id: tm.id, label: tTeams(`categories.${tm.category}` as any) }))}
            allLabel={tTeams("allTeams")}
            locale={locale}
          />

          <MasterFilterSelect
            name="category"
            locale={locale === "ar" ? "ar" : "fr"}
            label={locale === "ar" ? "التصنيف:" : "Catégorie :"}
            value={sp.category ?? ""}
            options={[
              { id: "", label: locale === "ar" ? "كافة التصنيفات" : "Toutes les catégories" },
              ...categories.map((c) => ({
                id: c.id,
                label: DOCUMENT_CATEGORY_LABELS[c.key]?.[locale === "ar" ? "ar" : "fr"] ?? c.name
              }))
            ]}
            headerTitle={locale === "ar" ? "تصفية حسب التصنيف" : "Filtrer par catégorie"}
          />

          <Button type="submit" variant="outline" size="sm" className="h-8 text-xs">
          <Filter className="h-4 w-4 shrink-0" />
            <span>{tCommon("filter")}</span>
          </Button>
        </form>
      </div>

      {/* ----------------- Documents Archive Table ----------------- */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">{t("fields.name")}</th>
              <th className="px-4 py-3 text-start font-semibold">{t("fields.category")}</th>
              <th className="px-4 py-3 text-start font-semibold">{tTeams("title")}</th>
              <th className="px-4 py-3 text-start font-semibold">{tCommon("status")}</th>
              <th className="px-4 py-3 text-start font-semibold">{tCommon("date")}</th>
              <th className="px-4 py-3 text-start font-semibold">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground leading-snug">{doc.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {doc.originalName} • {(doc.sizeBytes / 1024).toFixed(1)} KB
                      </p>
                      {doc.relatedMatch && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-semibold mt-1">
                          <Trophy className="h-3 w-3 shrink-0" />
                          <span>{locale === "ar" ? "مباراة:" : "Match:"} {localizedClubName(doc.relatedMatch.isHomeFixture ? doc.relatedMatch.awayTeamName : doc.relatedMatch.homeTeamName, locale, locale === "ar" ? "الفريق المنافس" : "Nom du club adverse")}</span>
                        </span>
                      )}
                      {doc.relatedPlayer && (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 text-[10px] font-semibold mt-1 ms-1">
                          <UserCheck className="h-3 w-3 shrink-0" />
                          <span>{doc.relatedPlayer.firstName} {doc.relatedPlayer.lastName}</span>
                        </span>
                      )}
                      {doc.relatedStaff && (
                        <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.2 text-[10px] font-semibold mt-1 ms-1">
                          <Users className="h-3 w-3 shrink-0" />
                          <span>{doc.relatedStaff.firstName} {doc.relatedStaff.lastName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-medium">
                  {doc.category.name}
                </td>
                <td className="px-4 py-3 text-xs">
                  {doc.team ? (
                    <span className="font-medium text-foreground">
                      {tTeams(`categories.${doc.team.category}` as any)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={CLASSIFICATION_TONE[doc.classification]} className="text-[10px]">
                    {t(`classification.${doc.classification}` as any)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(doc.createdAt)}
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <DocumentPreviewModal
                      documentId={doc.id}
                      title={doc.name}
                      fileName={doc.originalName}
                      mimeType={doc.mimeType}
                      locale={locale}
                      buttonLabel={locale === "ar" ? "معاينة" : "Aperçu"}
                      buttonSize="sm"
                    />
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      download
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted font-medium transition-colors shadow-2xs"
                      title={tCommon("download")}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{tCommon("download")}</span>
                    </a>
                    <Link
                      href={`/${locale}/dashboard/documents/${doc.id}`}
                      className="inline-flex items-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={tCommon("view")}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center">
                    <FolderArchive className="h-8 w-8 text-muted-foreground/60 mb-2" />
                    <p className="font-semibold text-foreground text-sm">{tCommon("noResults")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {locale === "ar"
                        ? "لم يتم العثور على وثائق مطابقة للتصفية الحالية في أرشيف النادي."
                        : "Aucun document trouvé correspondant à ce filtre."}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
