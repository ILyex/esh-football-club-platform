import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { hasPermission, requirePagePermission } from "@/lib/permissions";
import { getEffectiveTeamId } from "@/lib/team-context";
import { Eye, FileHeart, Pencil, Search, ShieldCheck, Users } from "lucide-react";
import { DocumentsNavTabs } from "@/components/documents/documents-nav-tabs";

export default async function MedicalRecordsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string; q?: string; page?: string }>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  const user = await requirePagePermission("medical.records.view", locale);
  const t = await getTranslations("dashboard.nav");
  const isAr = locale === "ar";
  const pageSize = 20;
  const requestedPage = Math.max(1, Number.parseInt(filters.page || "1", 10) || 1);
  const teamId = await getEffectiveTeamId(filters.team);
  const where = {
    status: { not: "ARCHIVED" as const },
    ...(teamId ? { teamId } : {}),
    ...(filters.q ? { OR: [
      { firstName: { contains: filters.q, mode: "insensitive" as const } },
      { lastName: { contains: filters.q, mode: "insensitive" as const } },
      { firstNameFr: { contains: filters.q, mode: "insensitive" as const } },
      { lastNameFr: { contains: filters.q, mode: "insensitive" as const } }
    ] } : {})
  };
  const totalPlayers = await db.player.count({ where });
  const pageCount = Math.max(1, Math.ceil(totalPlayers / pageSize));
  const currentPage = Math.min(requestedPage, pageCount);
  const players = await db.player.findMany({
    where,
    select: {
      id: true, firstName: true, lastName: true, firstNameFr: true, lastNameFr: true, photoUrl: true,
      team: { select: { name: true, category: true } },
      medicalRecords: { where: { type: { in: ["MEDICAL_CLEARANCE", "DRUG_TEST_RESULT", "LAB_ANALYSIS"] } }, orderBy: { createdAt: "desc" }, select: { type: true, status: true, expiresAt: true, documentId: true, document: { select: { status: true } } } }
    },
    orderBy: [{ team: { category: "asc" } }, { lastName: "asc" }],
    skip: (currentPage - 1) * pageSize,
    take: pageSize
  });
  const latest = players.map((p) => {
    const types = new Map<string, (typeof p.medicalRecords)[number]>();
    for (const record of p.medicalRecords) if (!types.has(record.type)) types.set(record.type, record);
    return { player: p, records: types };
  });
  const drugTests = latest.filter(({ records }) => records.has("DRUG_TEST_RESULT")).length;
  const needsReview = latest.filter(({ records }) => ["MEDICAL_CLEARANCE", "DRUG_TEST_RESULT", "LAB_ANALYSIS"].some((type) => records.get(type)?.document?.status !== "APPROVED")).length;
  const cards = [
    { label: isAr ? "عدد اللاعبين" : "Joueurs", value: totalPlayers, icon: Users },
    { label: isAr ? "لديهم كشف تعاطي المخدرات — في هذه الصفحة" : "Dépistage de drogues — cette page", value: drugTests, icon: ShieldCheck },
    { label: isAr ? "ملفات تحتاج مراجعة — في هذه الصفحة" : "Dossiers à vérifier — cette page", value: needsReview, icon: FileHeart }
  ];
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (filters.q) query.set("q", filters.q);
    if (filters.team) query.set("team", filters.team);
    query.set("page", String(page));
    return `/${locale}/dashboard/medical-records?${query.toString()}`;
  };
  const typeNames: Record<string, string> = isAr ? { MEDICAL_CLEARANCE: "الأهلية الطبية", DRUG_TEST_RESULT: "كشف تعاطي المخدرات", LAB_ANALYSIS: "التحاليل الطبية" } : { MEDICAL_CLEARANCE: "Aptitude médicale", DRUG_TEST_RESULT: "Dépistage de drogues", LAB_ANALYSIS: "Analyses médicales" };
  return (
    <main className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      <DocumentsNavTabs
        locale={locale}
        canViewDocuments={hasPermission(user, "documents.view")}
        canViewContracts={hasPermission(user, "contracts.view")}
        canViewMedicalRecords={hasPermission(user, "medical.records.view")}
        canViewCorrespondence={hasPermission(user, "correspondence.view")}
        canViewMeetings={hasPermission(user, "meetings.view")}
        canViewReports={hasPermission(user, "reports.view")}
      />
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div><h1 className="text-2xl font-black">{t("medicalRecords")}</h1><p className="mt-1 text-sm text-muted-foreground">{isAr ? "سجل صحي منفصل وسري لكل لاعب" : "Un dossier confidentiel distinct pour chaque joueur"}</p></div>
        <form className="flex gap-2" action={`/${locale}/dashboard/medical-records`}>
          <input name="q" defaultValue={filters.q} placeholder={isAr ? "ابحث عن لاعب" : "Rechercher un joueur"} className="h-10 rounded-xl border border-border bg-background px-3 text-sm" />
          <button aria-label={isAr ? "بحث" : "Rechercher"} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"><Search className="h-4 w-4" />{isAr ? "بحث" : "Rechercher"}</button>
        </form>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span><Icon className="h-4 w-4 text-primary" /></div><p className="mt-3 text-3xl font-black tabular-nums">{value}</p></div>)}
      </section>
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><div><h2 className="text-sm font-bold">{isAr ? "الملفات الطبية الفردية" : "Dossiers médicaux individuels"}</h2><p className="mt-0.5 text-xs text-muted-foreground">{isAr ? `عرض ${players.length} من ${totalPlayers} لاعب` : `${players.length} sur ${totalPlayers} joueurs`}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs tabular-nums">{currentPage} / {pageCount}</span></div>
        <div className="divide-y divide-border">
          {latest.map(({ player, records }) => {
            const clearance = records.get("MEDICAL_CLEARANCE");
            const clearanceLabel = clearance?.status === "FIT" && clearance.document?.status === "APPROVED" ? (isAr ? "مؤهل" : "Apte") : (isAr ? "تحتاج مراجعة" : "À vérifier");
            const drugTest = records.get("DRUG_TEST_RESULT");
            const analyses = records.get("LAB_ANALYSIS");
            const profileHref = `/${locale}/dashboard/medical-records/${player.id}`;
            return <article key={player.id} className="grid gap-3 px-4 py-3 transition hover:bg-muted/20 sm:grid-cols-[minmax(210px,1.2fr)_minmax(145px,.8fr)_minmax(170px,.9fr)_auto] sm:items-center">
              <div className="flex min-w-0 items-center gap-3">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full border border-border object-cover" /> : <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{player.firstName.slice(0, 1)}{player.lastName.slice(0, 1)}</span>}<div className="min-w-0"><p className="truncate text-sm font-bold">{isAr ? `${player.firstName} ${player.lastName}` : `${player.firstNameFr || player.firstName} ${player.lastNameFr || player.lastName}`}</p><p className="truncate text-[11px] text-muted-foreground">{player.team?.name || (isAr ? "بدون فئة" : "Sans catégorie")}</p></div></div>
              <p className="text-xs"><span className="text-muted-foreground">{typeNames.MEDICAL_CLEARANCE}: </span><span className={clearance?.status === "FIT" && clearance.document?.status === "APPROVED" ? "text-emerald-500" : "text-amber-500"}>{clearance ? clearanceLabel : (isAr ? "ناقص" : "Manquante")}</span></p>
              <p className="text-xs"><span className="text-muted-foreground">{typeNames.DRUG_TEST_RESULT} / {typeNames.LAB_ANALYSIS}: </span><span className={drugTest?.document?.status === "APPROVED" && analyses?.document?.status === "APPROVED" ? "text-emerald-500" : "text-amber-500"}>{drugTest || analyses ? (isAr ? "قيد المتابعة" : "En suivi") : (isAr ? "ناقصتان" : "Manquants")}</span></p>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`${profileHref}/preview`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11px] font-bold transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"><Eye className="h-3.5 w-3.5" />{isAr ? "معاينة الملف" : "Aperçu"}</Link>
                {hasPermission(user, "medical.records.manage") && <Link href={profileHref} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-primary-foreground transition hover:bg-primary/90"><Pencil className="h-3.5 w-3.5" />{isAr ? "تعديل الملف" : "Modifier"}</Link>}
              </div>
            </article>;
          })}
          {!latest.length && <p className="p-8 text-center text-sm text-muted-foreground">{isAr ? "لا يوجد لاعبون في هذا النطاق." : "Aucun joueur dans ce périmètre."}</p>}
        </div>
        {pageCount > 1 && <nav aria-label={isAr ? "صفحات اللاعبين" : "Pages des joueurs"} className="flex items-center justify-between border-t border-border px-4 py-3"><Link aria-disabled={currentPage <= 1} tabIndex={currentPage <= 1 ? -1 : undefined} className={`rounded-lg border border-border px-3 py-1.5 text-xs font-semibold ${currentPage <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted"}`} href={pageHref(Math.max(1, currentPage - 1))}>{isAr ? "السابق" : "Précédent"}</Link><span className="text-xs text-muted-foreground">{isAr ? `صفحة ${currentPage} من ${pageCount}` : `Page ${currentPage} sur ${pageCount}`}</span><Link aria-disabled={currentPage >= pageCount} tabIndex={currentPage >= pageCount ? -1 : undefined} className={`rounded-lg border border-border px-3 py-1.5 text-xs font-semibold ${currentPage >= pageCount ? "pointer-events-none opacity-40" : "hover:bg-muted"}`} href={pageHref(Math.min(pageCount, currentPage + 1))}>{isAr ? "التالي" : "Suivant"}</Link></nav>}
      </section>
    </main>
  );
}
