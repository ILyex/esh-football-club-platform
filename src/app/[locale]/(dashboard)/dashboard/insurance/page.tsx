import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { DocumentsNavTabs } from "@/components/documents/documents-nav-tabs";
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal";
import { QuickInsuranceUploadModal } from "@/components/insurance/quick-insurance-upload-modal";
import { DeleteInsuranceButton } from "@/components/insurance/delete-insurance-button";
import { InsuranceListPreviewModal } from "@/components/insurance/insurance-list-preview-modal";
import { InsuranceCategorySelect } from "@/components/insurance/insurance-category-select";
import { evaluatePlayerInsurance, parseInsuranceMetadata, formatInsuranceDate } from "@/lib/documents/insurance-helper";
import { getPlayerDisplayName } from "@/lib/utils";
import { arabicNationality, frenchNationality } from "@/lib/public/locale-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  FileText,
  Search,
  Filter,
  Eye,
  ExternalLink
} from "lucide-react";

export default async function InsurancePage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string; status?: string; q?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("documents.view", locale);
  const canUpdate = hasPermission(user, "players.update") || hasPermission(user, "documents.delete");
  const canViewContracts = hasPermission(user, "contracts.view");
  const canViewCorrespondence = hasPermission(user, "correspondence.view");
  const canViewMeetings = hasPermission(user, "meetings.view");

  const tTeams = await getTranslations("teams");
  const tPlayers = await getTranslations("players");
  const isAr = locale === "ar";

  const effectiveTeamId = await getEffectiveTeamId(sp.team);

  // Fetch authorized teams and all players with team and documents
  const [teams, allPlayers] = await Promise.all([
    getAuthorizedTeams(),
    db.player.findMany({
      where: {
        status: { not: "ARCHIVED" },
        ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}),
        ...(sp.q
          ? {
              OR: [
                { firstName: { contains: sp.q, mode: "insensitive" } },
                { lastName: { contains: sp.q, mode: "insensitive" } },
                { firstNameFr: { contains: sp.q, mode: "insensitive" } },
                { lastNameFr: { contains: sp.q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        team: true,
        documents: {
          select: {
            id: true,
            name: true,
            description: true,
            documentDate: true,
            mimeType: true,
            originalName: true,
            sizeBytes: true,
            createdAt: true
          }
        }
      },
      orderBy: [
        { team: { category: "asc" } },
        { shirtNumber: "asc" },
        { lastName: "asc" }
      ]
    })
  ]);

  const now = new Date();

  // Augment each player with insurance evaluation
  const enrichedPlayers = allPlayers.map((p) => {
    const insuranceEval = evaluatePlayerInsurance(p.documents, now);
    const meta = parseInsuranceMetadata(insuranceEval.document?.description);
    return {
      ...p,
      insuranceEval,
      isInsured: insuranceEval.isInsured,
      insuranceDoc: insuranceEval.document,
      policyNumber: meta?.policyNumber || null
    };
  });

  // Filter by insurance status if requested
  const filteredPlayers = enrichedPlayers.filter((p) => {
    if (sp.status === "insured") return p.insuranceEval.status === "INSURED";
    if (sp.status === "expiring") return p.insuranceEval.status === "EXPIRING_SOON";
    if (sp.status === "expired") return p.insuranceEval.status === "EXPIRED";
    if (sp.status === "uninsured") return p.insuranceEval.status === "NOT_INSURED";
    return true;
  });

  // Calculate Global Statistics
  const totalCount = enrichedPlayers.length;
  const validInsuredCount = enrichedPlayers.filter((p) => p.insuranceEval.status === "INSURED").length;
  const expiringCount = enrichedPlayers.filter((p) => p.insuranceEval.status === "EXPIRING_SOON").length;
  const expiredCount = enrichedPlayers.filter((p) => p.insuranceEval.status === "EXPIRED").length;
  const notInsuredCount = enrichedPlayers.filter((p) => p.insuranceEval.status === "NOT_INSURED").length;
  const insuredCount = validInsuredCount + expiringCount;
  const coverageRate = totalCount > 0 ? Math.round((insuredCount / totalCount) * 100) : 0;

  // Group players by Category / Team
  const categoriesMap = new Map<
    string,
    {
      teamId: string;
      teamName: string;
      category: string;
      players: typeof filteredPlayers;
      totalCategory: number;
      insuredCategory: number;
    }
  >();

  // Ensure teams in active scope are represented
  for (const t of teams) {
    if (effectiveTeamId && t.id !== effectiveTeamId) continue;
    categoriesMap.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      category: t.category,
      players: [],
      totalCategory: 0,
      insuredCategory: 0
    });
  }

  // Populate players into team categories
  for (const p of filteredPlayers) {
    const key = p.teamId || "unassigned";
    if (!categoriesMap.has(key)) {
      categoriesMap.set(key, {
        teamId: key,
        teamName: p.team?.name || (isAr ? "بدون فئة" : "Non assigné"),
        category: p.team?.category || "OTHER",
        players: [],
        totalCategory: 0,
        insuredCategory: 0
      });
    }
    const cat = categoriesMap.get(key)!;
    cat.players.push(p);
  }

  // Count totals for progress bars
  for (const p of enrichedPlayers) {
    const key = p.teamId || "unassigned";
    if (categoriesMap.has(key)) {
      const cat = categoriesMap.get(key)!;
      cat.totalCategory++;
      if (p.isInsured) cat.insuredCategory++;
    }
  }

  const categoryGroups = Array.from(categoriesMap.values()).filter(
    (cg) => cg.totalCategory > 0 || (effectiveTeamId && cg.teamId === effectiveTeamId)
  );

  const statusLabels: Record<string, string> = {
    INSURED: isAr ? "مؤمّن (ساري)" : "Valide",
    EXPIRING_SOON: isAr ? "ينتهي قريباً" : "Expire bientôt",
    EXPIRED: isAr ? "منتهي الصلاحية" : "Expiré",
    NOT_INSURED: isAr ? "غير مؤمّن" : "Non assuré"
  };
  const printGroups = categoryGroups.map((cg) => ({
    teamId: cg.teamId,
    label: isAr ? `فئة: ${tTeams(`categories.${cg.category}` as any)}` : cg.teamName,
    rows: cg.players.map((p) => ({
      id: p.id,
      name: getPlayerDisplayName(p, locale),
      position: tPlayers(`positions.${p.position}` as any),
      statusLabel: statusLabels[p.insuranceEval.status] ?? "",
      startDate: formatInsuranceDate(p.insuranceEval.startDate),
      endDate: formatInsuranceDate(p.insuranceEval.endDate),
      policyNumber: p.policyNumber || ""
    }))
  }));

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      <DocumentsNavTabs
        locale={locale}
        canViewDocuments={hasPermission(user, "documents.view")}
        canViewContracts={canViewContracts}
        canViewInsurance={true}
        canViewCorrespondence={canViewCorrespondence}
        canViewMeetings={canViewMeetings}
        canViewTemplates={hasPermission(user, "templates.view")}
        canManageTemplates={hasPermission(user, "templates.manage")}
        canViewReports={hasPermission(user, "reports.view")}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {isAr ? "سجل التأمين الرياضي للفئات واللاعبين" : "Assurance Sportive des Joueurs"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr
                  ? "متابعة وثائق التأمين الإلزامية لكل لاعب وتأكيد التغطية التأمينية للموسم الرياضي الحالي"
                  : "Suivi des attestations d'assurance obligatoires par catégorie et joueur"}
              </p>
            </div>
          </div>
        </div>

        {/* Coverage rate + category switcher + preview/print */}
        <div className="insurance-header-actions flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="insurance-coverage-card rounded-xl border border-border bg-card px-3 shadow-2xs text-end">
            <span className="max-w-[6.5rem] text-[10px] font-semibold leading-tight text-muted-foreground">
              {isAr ? "نسبة اللاعبين المؤمَّنين" : "Taux de joueurs assurés"}
            </span>
            <span className="shrink-0 whitespace-nowrap text-sm font-semibold font-mono tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
              {coverageRate}%
            </span>
          </div>
          <div className="insurance-category-control flex items-center">
            <InsuranceCategorySelect
              locale={locale}
              value={effectiveTeamId ?? "ALL"}
              status={sp.status}
              options={teams.map((t) => ({ id: t.id, label: tTeams(`categories.${t.category}` as any) }))}
            />
          </div>
          <div className="flex items-center">
            <InsuranceListPreviewModal groups={printGroups} locale={locale} />
          </div>
        </div>
      </div>

      {/* Standalone Player Name Search Bar (without any category dropdown, per user directive) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-2xl border border-border/70">
        <form method="GET" className="relative flex-1 max-w-md">
          {effectiveTeamId && <input type="hidden" name="team" value={effectiveTeamId} />}
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={sp.q || ""}
            placeholder={isAr ? "بحث عن لاعب بالاسم في سجل التأمين..." : "Rechercher un joueur dans le registre..."}
            className="w-full rounded-xl border border-border bg-card ps-9 pe-4 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-club-primary"
          />
        </form>
        {sp.q && (
          <Link
            href={`/${locale}/dashboard/insurance${effectiveTeamId || sp.status ? `?${new URLSearchParams({ ...(effectiveTeamId ? { team: effectiveTeamId } : {}), ...(sp.status ? { status: sp.status } : {}) }).toString()}` : ""}`}
            className="text-xs text-muted-foreground hover:text-club-primary underline shrink-0 px-2"
          >
            {isAr ? "إلغاء البحث" : "Effacer la recherche"}
          </Link>
        )}
      </div>

      {/* 4 Executive Metric Cards for Insurance Coverage & Expiries */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Insured & Valid */}
        <Link
          href={`/${locale}/dashboard/insurance?status=insured`}
          className={`rounded-xl border p-4 transition-all ${
            sp.status === "insured"
              ? "border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/20"
              : "border-border bg-card hover:border-emerald-500/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {isAr ? "سارٍ ومطابق" : "Valides"}
            </span>
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono tabular-nums text-foreground">
              {validInsuredCount}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {totalCount > 0 ? Math.round((validInsuredCount / totalCount) * 100) : 0}%
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {isAr ? "تأمين نشط وساري المفعول" : "Assurances actives"}
          </p>
        </Link>

        {/* Card 2: Expiring Soon */}
        <Link
          href={`/${locale}/dashboard/insurance?status=expiring`}
          className={`rounded-xl border p-4 transition-all ${
            sp.status === "expiring"
              ? "border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/20"
              : "border-border bg-card hover:border-amber-500/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
              {isAr ? "يقترب من الانتهاء (30 يوم)" : "Expire Bientôt"}
            </span>
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono tabular-nums text-foreground">
              {expiringCount}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {isAr ? "بحاجة تجديد" : "À renouveler"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {isAr ? "تنبيه استباقي للتجديد" : "Alerte de renouvellement"}
          </p>
        </Link>

        {/* Card 3: Expired */}
        <Link
          href={`/${locale}/dashboard/insurance?status=expired`}
          className={`rounded-xl border p-4 transition-all ${
            sp.status === "expired"
              ? "border-red-600 bg-red-600/10 shadow-xs ring-1 ring-red-600/20"
              : "border-border bg-card hover:border-red-600/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-600 dark:text-red-400">
              {isAr ? "منتهي الصلاحية" : "Expirés"}
            </span>
            <XCircle className="h-5 w-5 text-red-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono tabular-nums text-foreground">
              {expiredCount}
            </span>
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              {isAr ? "غير صالح" : "Invalide"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {isAr ? "انتهت فترة التأمين السابقة" : "Période expirée"}
          </p>
        </Link>

        {/* Card 4: Uninsured / No Document */}
        <Link
          href={`/${locale}/dashboard/insurance?status=uninsured`}
          className={`rounded-xl border p-4 transition-all ${
            sp.status === "uninsured"
              ? "border-rose-500 bg-rose-500/10 shadow-xs ring-1 ring-rose-500/20"
              : "border-border bg-card hover:border-rose-500/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              {isAr ? "بدون تأمين" : "Sans assurance"}
            </span>
            <ShieldAlert className="h-5 w-5 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono tabular-nums text-foreground">
              {notInsuredCount}
            </span>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {isAr ? "إيداع مطلوب" : "Requis"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {isAr ? "لم تُرفع له أي وثيقة" : "Aucun document"}
          </p>
        </Link>
      </div>

      {/* Category Breakdown & Players List */}
      <div className="space-y-6">
        {categoryGroups.map((group) => {
          const groupRate =
            group.totalCategory > 0
              ? Math.round((group.insuredCategory / group.totalCategory) * 100)
              : 0;

          return (
            <div
              key={group.teamId}
              className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden"
            >
              {/* Category Header Banner */}
              <div className="bg-muted/40 p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      {isAr ? `فئة: ${tTeams(`categories.${group.category}` as any)}` : group.teamName}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {group.insuredCategory} {isAr ? "مؤمّن من أصل" : "assurés sur"} {group.totalCategory} {isAr ? "لاعب" : "joueurs"}
                    </p>
                  </div>
                </div>

                {/* Category Progress Bar */}
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-muted rounded-full h-2 overflow-hidden border border-border/60">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        groupRate === 100
                          ? "bg-emerald-500"
                          : groupRate >= 50
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${groupRate}%` }}
                    />
                  </div>
                  <span
                    className={`font-mono text-xs font-bold ${
                      groupRate === 100
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {groupRate}%
                  </span>
                </div>
              </div>

              {/* Category Players Table */}
              {group.players.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/20 text-muted-foreground font-semibold">
                        <th className="px-4 py-2.5 text-center w-12">#</th>
                        <th className="px-4 py-2.5 text-start">{isAr ? "اسم اللاعب" : "Nom du joueur"}</th>
                        <th className="px-4 py-2.5 text-start">{isAr ? "المركز" : "Poste"}</th>
                        <th className="px-4 py-2.5 text-center w-36">{isAr ? "حالة التأمين" : "Statut Assurance"}</th>
                        <th className="px-4 py-2.5 text-start">{isAr ? "فترة السريان (البداية والنهاية)" : "Période de validité"}</th>
                        <th className="px-4 py-2.5 text-start">{isAr ? "وثيقة التأمين المثبتة" : "Document justificatif"}</th>
                        <th className="px-4 py-2.5 text-end">{isAr ? "الإجراءات" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {group.players.map((p, idx) => (
                        <tr
                          key={p.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                            {p.shirtNumber ?? idx + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                                {p.photoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={p.photoUrl}
                                    alt={`${p.firstName} ${p.lastName}`}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                    {(p.firstName[0] || "") + (p.lastName[0] || "")}
                                  </span>
                                )}
                              </div>
                              <div>
                                <Link
                                  href={`/${locale}/dashboard/players/${p.id}`}
                                  className="font-bold text-foreground hover:text-club-primary hover:underline"
                                >
                                  {getPlayerDisplayName(p, locale)}
                                </Link>
                                <span className="block text-[10px] text-muted-foreground">
                                  {locale === "ar" ? arabicNationality(p.nationality) : frenchNationality(p.nationality)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {tPlayers(`positions.${p.position}` as any)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.insuranceEval.status === "INSURED" && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>{isAr ? "مؤمّن (سارٍ)" : "Valide"}</span>
                              </span>
                            )}
                            {p.insuranceEval.status === "EXPIRING_SOON" && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400" title={isAr ? `ينتهي خلال ${p.insuranceEval.daysRemaining} يوم` : `Expire dans ${p.insuranceEval.daysRemaining} jours`}>
                                <Clock className="h-3.5 w-3.5" />
                                <span>{isAr ? `ينتهي قريباً (${p.insuranceEval.daysRemaining}ي)` : `Expire bientôt (${p.insuranceEval.daysRemaining}j)`}</span>
                              </span>
                            )}
                            {p.insuranceEval.status === "EXPIRED" && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600/15 border border-red-600/30 px-2.5 py-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                                <XCircle className="h-3.5 w-3.5" />
                                <span>{isAr ? "منتهي الصلاحية" : "Expiré"}</span>
                              </span>
                            )}
                            {p.insuranceEval.status === "NOT_INSURED" && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>{isAr ? "غير مؤمّن" : "Non assuré"}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {p.insuranceEval.endDate ? (
                              <div className="space-y-0.5 font-mono text-[11px]">
                                <div className="text-foreground flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground">{isAr ? "إلى:" : "Au:"}</span>
                                  <span className="font-semibold">{formatInsuranceDate(p.insuranceEval.endDate)}</span>
                                </div>
                                {p.insuranceEval.startDate && (
                                  <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                                    <span>{isAr ? "من:" : "Du:"}</span>
                                    <span>{formatInsuranceDate(p.insuranceEval.startDate)}</span>
                                  </div>
                                )}
                              </div>
                            ) : p.insuranceDoc ? (
                              <span className="text-[11px] text-muted-foreground">
                                {isAr ? "طوال الموسم الرياضي" : "Saison en cours"}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/60">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {p.insuranceDoc ? (
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="truncate max-w-[180px] font-mono text-[11px] text-foreground">
                                  {p.insuranceDoc.originalName || p.insuranceDoc.name}
                                </span>
                                <DocumentPreviewModal
                                  documentId={p.insuranceDoc.id}
                                  title={p.insuranceDoc.name}
                                  mimeType={p.insuranceDoc.mimeType}
                                  fileName={p.insuranceDoc.originalName}
                                  buttonLabel={isAr ? "معاينة" : "Voir"}
                                  buttonVariant="ghost"
                                  buttonSize="sm"
                                  locale={locale}
                                />
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                {isAr ? "لا توجد وثيقة تأمين مسجلة" : "Aucun document"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-end">
                            <div className="flex items-center justify-end gap-2">
                              {canUpdate && (
                                <>
                                  <QuickInsuranceUploadModal
                                    playerId={p.id}
                                    playerName={`${p.firstName} ${p.lastName}`}
                                    teamCategory={tTeams(`categories.${group.category}` as any)}
                                    locale={locale}
                                  />
                                  {p.insuranceDoc && (
                                    <DeleteInsuranceButton
                                      playerId={p.id}
                                      documentId={p.insuranceDoc.id}
                                      playerName={`${p.firstName} ${p.lastName}`}
                                      locale={locale}
                                    />
                                  )}
                                </>
                              )}
                              <Link
                                href={`/${locale}/dashboard/players/${p.id}`}
                                className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 hover:underline ps-1"
                              >
                                <span>{isAr ? "الملف" : "Profil"}</span>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <p>{isAr ? "لا يوجد لاعبون مطابقون للتصفية في هذه الفئة" : "Aucun joueur dans cette catégorie"}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
