import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentsNavTabs } from "@/components/documents/documents-nav-tabs";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";
import {
  FileCheck,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
  User,
  Users,
  Calendar,
  Filter,
  Clock,
  CheckCircle,
  FileText,
  Search
} from "lucide-react";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "danger",
  PENDING: "neutral"
};

const EXPIRY_WINDOW_DAYS = 60;

export default async function ContractsListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; team?: string; page?: string; q?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("contracts.view", locale);
  const canManage = hasPermission(user, "contracts.manage");
  const canViewCorrespondence = hasPermission(user, "correspondence.view");
  const canViewMeetings = hasPermission(user, "meetings.view");

  const t = await getTranslations("contracts");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const isAr = locale === "ar";
  const pageSize = 20;
  const page = Math.max(1, Number(sp.page ?? "1"));
  const effectiveTeamId = await getEffectiveTeamId(sp.team);

  const where: any = {
    ...(sp.status ? { status: sp.status as any } : {}),
    ...(effectiveTeamId ? { teamId: effectiveTeamId } : {})
  };

  if (sp.q && sp.q.trim()) {
    const qStr = sp.q.trim();
    where.OR = [
      { player: { firstName: { contains: qStr, mode: "insensitive" } } },
      { player: { lastName: { contains: qStr, mode: "insensitive" } } },
      { staff: { firstName: { contains: qStr, mode: "insensitive" } } },
      { staff: { lastName: { contains: qStr, mode: "insensitive" } } }
    ];
  }

  const soon = new Date(Date.now() + EXPIRY_WINDOW_DAYS * 24 * 3600 * 1000);

  const [
    contracts,
    total,
    expiringSoon,
    activeCount,
    pendingCount,
    teams
  ] = await Promise.all([
    db.contract.findMany({
      where,
      include: {
        player: { include: { team: true } },
        staff: true,
        team: true,
        document: true
      },
      orderBy: { endDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    db.contract.count({ where }),
    db.contract.findMany({
      where: {
        status: { in: ["ACTIVE", "PENDING", "EXPIRING_SOON"] },
        endDate: { lte: soon },
        ...(effectiveTeamId ? { teamId: effectiveTeamId } : {})
      },
      include: { player: true, staff: true },
      orderBy: { endDate: "asc" },
      take: 6
    }),
    db.contract.count({
      where: { status: "ACTIVE", ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}) }
    }),
    db.contract.count({
      where: { status: "PENDING", ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}) }
    }),
    getAuthorizedTeams()
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const subjectInfo = (c: typeof contracts[0]) => {
    if (c.player) {
      return {
        name: `${c.player.firstName} ${c.player.lastName}`,
        type: "PLAYER" as const,
        roleOrTeam: c.player.team ? tTeams(`categories.${c.player.team.category}` as any) : (c.player.position ?? "لاعب"),
        avatarTone: "bg-blue-500/10 text-blue-600 dark:text-blue-400"
      };
    }
    if (c.staff) {
      return {
        name: `${c.staff.firstName} ${c.staff.lastName}`,
        type: "STAFF" as const,
        roleOrTeam: c.staff.role ?? "طاقم",
        avatarTone: "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      };
    }
    return {
      name: "—",
      type: "UNKNOWN" as const,
      roleOrTeam: "—",
      avatarTone: "bg-muted text-muted-foreground"
    };
  };

  return (
    <div className="space-y-6">
      {/* ── Document Navigation Tabs ── */}
      <DocumentsNavTabs
        locale={locale}
        canViewDocuments={hasPermission(user, "documents.view")}
        canViewContracts={true}
        canViewMedicalRecords={hasPermission(user, "medical.records.view")}
        canViewCorrespondence={canViewCorrespondence}
        canViewMeetings={canViewMeetings}
        canViewTemplates={hasPermission(user, "templates.view")}
        canManageTemplates={hasPermission(user, "templates.manage")}
        canViewReports={hasPermission(user, "reports.view")}
      />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-club-primary/10 text-club-primary">
              <FileCheck className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{t("title")}</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {isAr
              ? "متابعة وتدقيق العقود الرياضية والإدارية للاعبين والطواقم الفنية وتواريخ انقضائها"
              : "Gestion et suivi des contrats sportifs et administratifs des joueurs et du staff"}
          </p>
        </div>

        {canManage && (
          <Link href={`/${locale}/dashboard/contracts/new`}>
            <Button className="bg-club-primary hover:bg-club-primary/90 text-white font-medium flex items-center gap-2 shadow-xs">
              <Plus className="h-4 w-4" />
              <span>{t("addContract")}</span>
            </Button>
          </Link>
        )}
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">{isAr ? "إجمالي العقود" : "Total Contrats"}</span>
            <FileText className="h-4 w-4 text-club-primary" />
          </div>
          <p className="mt-2 text-2xl font-black text-foreground [font-family:Arial,sans-serif]">{total}</p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">{isAr ? "سجل النادي الرسمي" : "Archives du club"}</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">{t("statuses.ACTIVE")}</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 [font-family:Arial,sans-serif]">{activeCount}</p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">{isAr ? "عقود سارية ومفعلة" : "Contrats actifs"}</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">{t("statuses.EXPIRING_SOON")}</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400 [font-family:Arial,sans-serif]">{expiringSoon.length}</p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">{isAr ? `تنتهي خلال ${EXPIRY_WINDOW_DAYS} يوماً` : `< 60 jours restants`}</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">{t("statuses.PENDING")}</span>
            <Clock className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-sky-600 dark:text-sky-400 [font-family:Arial,sans-serif]">{pendingCount}</p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">{isAr ? "بانتظار الاعتماد النهائي" : "En cours de validation"}</span>
        </div>
      </div>

      {/* ── Expiring Soon Alert Banner ── */}
      {expiringSoon.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              {isAr ? `تنبيه: ${expiringSoon.length} عقود تنتهي خلال ${EXPIRY_WINDOW_DAYS} يوماً قادمة` : `Alerte : ${expiringSoon.length} contrats expirent dans les 60 prochains jours`}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {expiringSoon.map((c) => {
              const name = c.player ? `${c.player.firstName} ${c.player.lastName}` : c.staff ? `${c.staff.firstName} ${c.staff.lastName}` : "—";
              return (
                <Link
                  key={c.id}
                  href={`/${locale}/dashboard/contracts/${c.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-card border border-amber-500/20 hover:border-amber-500/50 transition-colors shadow-xs group"
                >
                  <div className="truncate">
                    <p className="text-xs font-bold text-foreground group-hover:text-club-primary transition-colors truncate">
                      {name}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span className="[font-family:Arial,sans-serif] font-bold">
                        {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(c.endDate)}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md">
                    {t(`types.${c.type}` as any)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <form className="dashboard-filter-toolbar mb-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder={isAr ? "بحث باسم اللاعب أو عضو الطاقم..." : "Recherche par nom..."}
            className="w-full rounded-xl border border-border bg-background ps-9 pe-3 py-2 text-sm focus:border-club-primary focus:ring-1 focus:ring-club-primary"
          />
        </div>

        <MasterFilterSelect
          name="team"
          locale={locale === "ar" ? "ar" : "fr"}
          label={isAr ? "الفئة:" : "Catégorie :"}
          value={sp.team ?? effectiveTeamId ?? "ALL"}
          options={[{ id: "ALL", label: tTeams("allTeams") }, ...teams.map((tm) => ({ id: tm.id, label: tTeams(`categories.${tm.category}` as any) }))]}
          headerTitle={isAr ? "تصفية حسب الفئة" : "Filtrer par catégorie"}
        />

        <MasterFilterSelect
          name="status"
          locale={locale === "ar" ? "ar" : "fr"}
          label={tCommon("status")}
          value={sp.status ?? ""}
          options={[{ id: "", label: isAr ? "كل الحالات" : "Tous les statuts" }, ...["ACTIVE", "EXPIRING_SOON", "EXPIRED", "PENDING"].map((s) => ({ id: s, label: t(`statuses.${s}` as any) }))]}
          headerTitle={isAr ? "تصفية حسب الحالة" : "Filtrer par statut"}
        />

        <Button type="submit" variant="outline" className="rounded-xl flex items-center gap-1.5 px-4">
          <Filter className="h-4 w-4" />
          <span>{tCommon("filter")}</span>
        </Button>
      </form>

      {/* ── Contracts Table ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5 text-start">{t("fields.player")} / {t("fields.staff")}</th>
                <th className="px-5 py-3.5 text-start">{tTeams("title")}</th>
                <th className="px-5 py-3.5 text-start">{t("fields.type")}</th>
                <th className="px-5 py-3.5 text-start">{t("fields.startDate")}</th>
                <th className="px-5 py-3.5 text-start">{t("fields.endDate")}</th>
                <th className="px-5 py-3.5 text-start">{tCommon("status")}</th>
                <th className="px-5 py-3.5 text-start">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {contracts.map((c) => {
                const sub = subjectInfo(c);
                return (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    {/* Subject */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold ${sub.avatarTone}`}>
                          {sub.type === "PLAYER" ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{sub.name}</p>
                          <p className="text-xs text-muted-foreground">{sub.roleOrTeam}</p>
                        </div>
                      </div>
                    </td>

                    {/* Team */}
                    <td className="px-5 py-4">
                      {c.team ? (
                        <span className="text-xs font-medium text-foreground">
                          {tTeams(`categories.${c.team.category}` as any)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Contract Type */}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-muted text-foreground border border-border/80">
                        {t(`types.${c.type}` as any)}
                      </span>
                    </td>

                    {/* Start Date */}
                    <td className="px-5 py-4 text-xs text-muted-foreground [font-family:Arial,sans-serif] font-bold">
                      {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(c.startDate)}
                    </td>

                    {/* End Date */}
                    <td className="px-5 py-4 text-xs font-bold [font-family:Arial,sans-serif] text-foreground">
                      {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(c.endDate)}
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-4">
                      <Badge tone={STATUS_TONE[c.status]}>{t(`statuses.${c.status}` as any)}</Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <Link
                        href={`/${locale}/dashboard/contracts/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-club-primary hover:underline"
                      >
                        {tCommon("edit")}
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {contracts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <FileCheck className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-base font-bold text-foreground">
                      {isAr ? "لا توجد عقود مسجلة" : "Aucun contrat enregistré"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      {isAr
                        ? "لم يتم العثور على أي عقود تطابق معايير التصفية المحددة. يمكنك إضافة عقد جديد بسهولة."
                        : "Aucun contrat ne correspond aux critères de filtre sélectionnés. Vous pouvez en ajouter un nouveau."}
                    </p>
                    {canManage && (
                      <Link href={`/${locale}/dashboard/contracts/new`} className="inline-block mt-4">
                        <Button size="sm" className="bg-club-primary hover:bg-club-primary/90 text-white font-medium">
                          <Plus className="h-4 w-4 me-1.5" />
                          <span>{t("addContract")}</span>
                        </Button>
                      </Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Footer ── */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground bg-muted/20">
          <p className="[font-family:Arial,sans-serif] font-bold">
            {total} {isAr ? "عقد مسجل" : "contrats"} • {tCommon("view")} {page}/{totalPages}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={`/${locale}/dashboard/contracts?${new URLSearchParams({ ...sp, page: String(page - 1) } as any)}`}
                aria-label={isAr ? "الصفحة السابقة" : "Page précédente"}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-foreground shadow-sm transition-colors hover:border-club-primary hover:bg-club-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary focus-visible:ring-offset-2"
              >
                {isAr ? <ChevronRight className="size-5 stroke-[2.5]" /> : <ChevronLeft className="size-5 stroke-[2.5]" />}
                <span>{isAr ? "السابق" : "Précédent"}</span>
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/${locale}/dashboard/contracts?${new URLSearchParams({ ...sp, page: String(page + 1) } as any)}`}
                aria-label={isAr ? "الصفحة التالية" : "Page suivante"}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-foreground shadow-sm transition-colors hover:border-club-primary hover:bg-club-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary focus-visible:ring-offset-2"
              >
                <span>{isAr ? "التالي" : "Suivant"}</span>
                {isAr ? <ChevronLeft className="size-5 stroke-[2.5]" /> : <ChevronRight className="size-5 stroke-[2.5]" />}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
