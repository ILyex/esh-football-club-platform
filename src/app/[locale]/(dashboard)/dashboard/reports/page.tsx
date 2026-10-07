import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { resolveUserTeamContext } from "@/lib/team-context";
import { ReportsClientHub } from "@/components/reports/reports-client-hub";
import { ReportItemData } from "@/components/reports/report-print-modal";
import { formatDateToDMY } from "@/lib/date-utils";

export default async function ReportsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  await requirePagePermission("reports.view", locale);

  const [teamContext, tPlayers, tTeams, tContracts, tTraining, tStaff] = await Promise.all([
    resolveUserTeamContext(sp.team),
    getTranslations("players"),
    getTranslations("teams"),
    getTranslations("contracts"),
    getTranslations("training"),
    getTranslations("staff")
  ]);
  const isAr = locale.toLowerCase().startsWith("ar");
  const effectiveTeamId = teamContext.activeTeamId ?? undefined;
  const teamWhere = effectiveTeamId ? { teamId: effectiveTeamId } : {};
  const teams = teamContext.authorizedTeams;
  const scopeTeam = teams.find((team) => team.id === effectiveTeamId);
  const scopeLabel = scopeTeam
    ? tTeams(`categories.${scopeTeam.category}` as any)
    : teamContext.canSelectAll
      ? isAr ? "جميع الفئات" : "Toutes les catégories"
      : isAr ? "لا توجد فئة متاحة" : "Aucune catégorie disponible";

  const [
    playersByPosition,
    playersByTeam,
    staffByRole,
    contractsByStatus,
    matches,
    attendanceByStatus,
    documentsByCategory,
    totalPlayersCount,
    treasuryByType,
    categories
  ] = await Promise.all([
    db.player.groupBy({ by: ["position"], _count: true, where: { ...teamWhere, status: { not: "ARCHIVED" } }, orderBy: { position: "asc" } }),
    db.player.groupBy({ by: ["teamId"], _count: true, where: { ...teamWhere, status: { not: "ARCHIVED" } }, orderBy: { teamId: "asc" } }),
    db.staff.groupBy({ by: ["role"], _count: true, where: { ...teamWhere, status: "ACTIVE" }, orderBy: { role: "asc" } }),
    db.contract.groupBy({ by: ["status"], _count: true, where: teamWhere, orderBy: { status: "asc" } }),
    db.match.findMany({ where: { ...teamWhere, status: "FINISHED" }, select: { isHomeFixture: true, homeScore: true, awayScore: true } }),
    db.trainingAttendance.groupBy({ by: ["status"], _count: true, where: { training: teamWhere }, orderBy: { status: "asc" } }),
    db.document.groupBy({ by: ["categoryId"], _count: true, where: teamWhere, orderBy: { categoryId: "asc" } }),
    db.player.count({ where: { ...teamWhere, status: { not: "ARCHIVED" } } }),
    db.treasuryTransaction.groupBy({ by: ["type"], _count: { _all: true }, _sum: { amount: true }, orderBy: { type: "asc" } }),
    db.documentCategory.findMany({ select: { id: true, name: true } })
  ]);

  const categoryName = new Map(categories.map((category) => [category.id, category.name] as const));
  const teamName = new Map(teams.map((team) => [team.id, tTeams(`categories.${team.category}` as any)] as const));
  const documentsCount = documentsByCategory.reduce((sum, item) => sum + item._count, 0);
  const activeStaffCount = staffByRole.reduce((sum, item) => sum + item._count, 0);
  const scoredMatches = matches.filter((match) => match.homeScore != null && match.awayScore != null);

  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const match of scoredMatches) {
    const ourScore = match.isHomeFixture ? match.homeScore! : match.awayScore!;
    const opponentScore = match.isHomeFixture ? match.awayScore! : match.homeScore!;
    if (ourScore > opponentScore) wins++;
    else if (ourScore === opponentScore) draws++;
    else losses++;
  }

  const treasuryFor = (type: "DEPOSIT" | "WITHDRAWAL") => treasuryByType.find((item) => item.type === type);
  const deposits = treasuryFor("DEPOSIT");
  const withdrawals = treasuryFor("WITHDRAWAL");
  const formatDzd = (value: number) => {
    const number = new Intl.NumberFormat(isAr ? "ar-DZ" : "fr-DZ", { maximumFractionDigits: 0 }).format(value);
    return isAr ? `${number}\u00a0د.ج` : `${number}\u00a0DZD`;
  };
  const today = formatDateToDMY(new Date());
  const scopedSummary = isAr ? `النطاق: ${scopeLabel}.` : `Périmètre : ${scopeLabel}.`;
  const reportsList: ReportItemData[] = [
    {
      title: isAr ? "تقرير تعداد اللاعبين" : "Rapport des effectifs joueurs",
      department: isAr ? "شؤون اللاعبين" : "Pôle joueurs",
      scope: scopeLabel,
      date: today,
      summary: isAr
        ? `${scopedSummary} يشمل اللاعبون غير المؤرشفين، موزعين حسب الفئة والمركز المسجل في ملفاتهم.`
        : `${scopedSummary} Le rapport inclut les joueurs non archivés, répartis par catégorie et poste enregistré.`,
      stats: [
        { label: isAr ? "اللاعبون غير المؤرشفين" : "Joueurs non archivés", value: totalPlayersCount },
        { label: isAr ? "الفئات ضمن النطاق" : "Catégories du périmètre", value: effectiveTeamId ? (scopeTeam ? 1 : 0) : teams.length },
        { label: isAr ? "حراس المرمى" : "Gardiens", value: playersByPosition.find((item) => item.position === "GOALKEEPER")?._count ?? 0 },
        { label: isAr ? "المهاجمون" : "Attaquants", value: playersByPosition.find((item) => item.position === "FORWARD")?._count ?? 0 }
      ]
    },
    {
      title: isAr ? "تقرير الطاقم النشط" : "Rapport du staff actif",
      department: isAr ? "الإدارة الفنية والإدارية" : "Encadrement technique et administratif",
      scope: scopeLabel,
      date: today,
      summary: isAr
        ? `${scopedSummary} الأعداد محسوبة من أعضاء الطاقم ذوي الحالة النشطة وموزعة حسب المهام المسجلة.`
        : `${scopedSummary} Les chiffres proviennent des membres actifs et sont répartis selon leur fonction enregistrée.`,
      stats: [
        { label: isAr ? "أعضاء الطاقم النشطون" : "Membres actifs", value: activeStaffCount },
        ...staffByRole.map((item) => ({ label: tStaff(`roles.${item.role}` as any), value: item._count }))
      ]
    },
    {
      title: isAr ? "تقرير نتائج المباريات" : "Rapport des résultats des matchs",
      department: isAr ? "الإدارة الفنية" : "Direction technique",
      scope: scopeLabel,
      date: today,
      summary: isAr
        ? `${scopedSummary} تشمل الحصيلة المباريات المنتهية التي سُجلت نتيجتها؛ المباريات التي لا تحتوي نتيجة مستبعدة من احتساب الفوز والتعادل والخسارة.`
        : `${scopedSummary} Le bilan compte les matchs terminés avec un score enregistré ; les scores manquants sont exclus du calcul des résultats.`,
      stats: [
        { label: isAr ? "مباريات منتهية بنتيجة مسجلة" : "Matchs terminés avec score", value: scoredMatches.length },
        { label: isAr ? "فوز" : "Victoires", value: wins },
        { label: isAr ? "تعادل" : "Nuls", value: draws },
        { label: isAr ? "خسارة" : "Défaites", value: losses }
      ]
    },
    {
      title: isAr ? "ملخص حركات الخزينة" : "Synthèse des mouvements de trésorerie",
      department: isAr ? "المالية والخزينة" : "Finances et trésorerie",
      scope: isAr ? "على مستوى النادي" : "Club entier",
      date: today,
      summary: isAr
        ? "مبالغ الإيداعات والسحوبات المسجلة في دفتر الخزينة على مستوى النادي. هذا الملخص لا يمثل رصيداً محاسبياً أو تقرير تدقيق."
        : "Montants des dépôts et retraits inscrits au registre de trésorerie du club. Cette synthèse ne constitue ni un solde comptable ni un audit.",
      stats: [
        { label: isAr ? "عدد الإيداعات" : "Nombre de dépôts", value: deposits?._count._all ?? 0 },
        { label: isAr ? "مبالغ الإيداعات" : "Montant des dépôts", value: formatDzd(deposits?._sum.amount ?? 0) },
        { label: isAr ? "عدد السحوبات" : "Nombre de retraits", value: withdrawals?._count._all ?? 0 },
        { label: isAr ? "مبالغ السحوبات" : "Montant des retraits", value: formatDzd(withdrawals?._sum.amount ?? 0) }
      ]
    },
    {
      title: isAr ? "تقرير سجل الوثائق" : "Rapport du registre documentaire",
      department: isAr ? "الأرشيف" : "Archives",
      scope: scopeLabel,
      date: today,
      summary: isAr
        ? `${scopedSummary} يعرض عدد سجلات الوثائق المسجلة حسب التصنيف، بجميع حالات المراجعة والأرشفة.`
        : `${scopedSummary} Le rapport compte les documents enregistrés par catégorie, tous statuts de révision et d'archivage confondus.`,
      stats: [
        { label: isAr ? "سجلات الوثائق" : "Documents enregistrés", value: documentsCount },
        { label: isAr ? "تصنيفات تحتوي وثائق" : "Catégories avec documents", value: documentsByCategory.length }
      ]
    }
  ];

  const departments = [
    { id: "ALL", label: isAr ? "جميع الأقسام" : "Tous les pôles" },
    ...reportsList.map((report) => ({ id: report.department, label: report.department })).filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index)
  ];

  const chartsData = {
    playersByPosition: playersByPosition.map((item) => ({
      label: item.position ? tPlayers(`positions.${item.position}` as any) : isAr ? "غير محدد" : "Non défini",
      value: item._count
    })),
    playersByTeam: playersByTeam.map((item) => ({
      label: item.teamId
        ? teamName.get(item.teamId) ?? (isAr ? "فئة أخرى" : "Autre catégorie")
        : isAr ? "غير مسندين إلى فئة" : "Sans catégorie",
      value: item._count
    })),
    staffByRole: staffByRole.map((item) => ({ label: tStaff(`roles.${item.role}` as any), value: item._count })),
    matchesDistribution: [
      { label: isAr ? "فوز" : "Victoires", value: wins },
      { label: isAr ? "تعادل" : "Nuls", value: draws },
      { label: isAr ? "خسارة" : "Défaites", value: losses }
    ].filter((item) => item.value > 0),
    contractsByStatus: contractsByStatus.map((item) => ({
      label: tContracts(`statuses.${item.status}` as any) || item.status,
      value: item._count
    })),
    attendanceByStatus: attendanceByStatus.map((item) => ({
      label: tTraining(`attendance.${item.status}` as any) || item.status,
      value: item._count
    })),
    documentsByCategory: documentsByCategory.map((item) => ({
      label: categoryName.get(item.categoryId) ?? (isAr ? "تصنيف غير معروف" : "Catégorie inconnue"),
      value: item._count
    }))
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">{isAr ? "مركز التقارير والمؤشرات" : "Centre de rapports et indicateurs"}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {isAr
            ? "ملخصات قابلة للطباعة ورسوم مبنية مباشرة على السجلات الحالية. اختر الفئة لمقارنة بياناتها؛ حركات الخزينة تبقى على مستوى النادي."
            : "Synthèses imprimables et graphiques calculés à partir des données enregistrées. Choisissez une catégorie pour la filtrer ; la trésorerie reste à l'échelle du club."}
        </p>
      </div>

      <ReportsClientHub
        locale={locale}
        reportsList={reportsList}
        departments={departments}
        chartsData={chartsData}
        teamFilter={{
          value: effectiveTeamId ?? (teamContext.canSelectAll ? "ALL" : (teams[0]?.id ?? "")),
          options: teams.map((team) => ({ id: team.id, label: tTeams(`categories.${team.category}` as any) })),
          allLabel: tTeams("allTeams"),
          canSelectAll: teamContext.canSelectAll
        }}
      />
    </div>
  );
}
