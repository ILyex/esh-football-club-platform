import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamCategoryChart } from "@/components/teams/team-category-chart";
import { ROSTER_PLAYER_STATUSES } from "@/lib/teams/roster";
import { localizedClubName } from "@/lib/public/locale-text";
import { Shield, Users, Trophy, FileCheck, ArrowRight, UserCog, Edit3, CalendarDays, ShieldCheck } from "lucide-react";
import { uploadTeamInsuranceAction } from "./insurance-actions";
import { DateInput } from "@/components/ui/date-input";
import { TeamInsuranceFileInput } from "@/components/teams/team-insurance-file-input";

const CATEGORY_ORDER = ["SENIOR", "U20", "U17", "U15"] as const;

export default async function TeamsListPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ insurance?: string }> }) {
  const { locale } = await params;
  const notices = await searchParams;
  const isAr = locale === "ar";
  const user = await requirePagePermission("teams.view", locale);
  const t = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "teams.manage");

  const teams = await db.team.findMany({
    include: {
      _count: {
        select: {
          players: { where: { status: { in: [...ROSTER_PLAYER_STATUSES] } } },
          staff: true,
          matches: true,
          contracts: true
        }
      },
      players: {
        where: { status: { in: [...ROSTER_PLAYER_STATUSES] } },
        select: { position: true }
      },
      insurancePolicies: { orderBy: { createdAt: "desc" }, include: { document: { select: { id: true, originalName: true, status: true } } } }
    }
  });

  const sorted = [...teams].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category as any) - CATEGORY_ORDER.indexOf(b.category as any)
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAr
              ? "متابعة فئات النادي، التشكيلات التكتيكية، الطواقم الفنية والمباريات الرسمية"
              : "Gestion des catégories sportives, effectifs et staff technique"}
          </p>
        </div>
      </div>
      {notices.insurance === "queued" && <p role="status" className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-700 dark:text-sky-300">{isAr ? "تم رفع وثيقة التأمين. يجري فحص مطابقتها للفئة والتواريخ قبل تحديث حالة التأمين." : "Document téléversé. Vérification de la catégorie et des dates avant la mise à jour du statut."}</p>}

      {/* Grid of Team Category Cards with Charts */}
      <div className="grid gap-5 md:grid-cols-2">
        {sorted.map((team) => {
          // Compute position distribution
          const posCounts: Record<string, number> = {};
          for (const p of team.players) {
            posCounts[p.position] = (posCounts[p.position] || 0) + 1;
          }
          const playersByPosition = Object.entries(posCounts).map(([position, count]) => ({
            position,
            count
          }));
          const today = new Date();
          const verifiedInsurance = team.insurancePolicies.find((item) => item.checkStatus === "CHECKED" && item.document.status === "APPROVED" && item.startDate <= today && item.endDate >= today);
          const latestInsurance = team.insurancePolicies[0];
          const insurance = verifiedInsurance || latestInsurance;
          const insuranceActive = !!verifiedInsurance;
          const insuranceStale = !insuranceActive && latestInsurance?.checkStatus === "QUEUED" && Date.now() - latestInsurance.createdAt.getTime() > 10 * 60 * 1000;
          const insurancePending = !insuranceActive && latestInsurance?.checkStatus === "QUEUED" && !insuranceStale;
          const scheduledInsurance = !insuranceActive && latestInsurance?.checkStatus === "CHECKED" && latestInsurance.startDate > today;
          const insuranceLabel = insuranceActive ? (isAr ? "الفئة مؤمّنة" : "Catégorie assurée") : insurancePending ? (isAr ? "قيد فحص الذكاء الاصطناعي" : "Vérification IA en cours") : insuranceStale ? (isAr ? "تأخر الفحص — أعد رفع الوثيقة" : "Vérification bloquée — téléverser à nouveau") : scheduledInsurance ? (isAr ? "تبدأ التغطية لاحقاً" : "Couverture à venir") : latestInsurance?.checkStatus === "NEEDS_REVIEW" ? (isAr ? "تعذر التحقق — مراجعة مطلوبة" : "À vérifier manuellement") : insurance && insurance.endDate < today ? (isAr ? "انتهى التأمين" : "Assurance expirée") : latestInsurance?.checkStatus === "UNAVAILABLE" ? (isAr ? "الفحص غير متاح — مراجعة مطلوبة" : "Contrôle indisponible — vérifier") : (isAr ? "لا توجد وثيقة تأمين" : "Aucune assurance");
          const insuranceDate = (date: Date) => new Intl.DateTimeFormat(isAr ? "ar-DZ" : "fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(date);

          return (
            <div
              key={team.id}
              className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs hover:border-club-primary/40 transition-all duration-200"
            >
              <div>
                {/* Top Header */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary border border-club-primary/20">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-foreground">
                          {t(`categories.${team.category}` as any)}
                        </h2>
                        {team.active ? (
                          <Badge tone="success" className="text-[10px] font-semibold">
                            {isAr ? "نشطة رسمياً" : "Actif"}
                          </Badge>
                        ) : (
                          <Badge tone="neutral" className="text-[10px]">
                            {isAr ? "غير مفعلة" : "Inactif"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">{localizedClubName(team.name, locale, t(`categories.${team.category}` as any))}</p>
                    </div>
                  </div>

                  {canManage && (
                    <Link href={`/${locale}/dashboard/teams/${team.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-semibold gap-1.5 hover:bg-club-primary/10 hover:text-club-primary"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>{tCommon("edit")}</span>
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Birth year eligibility badge */}
                {(team.birthYearFrom || team.birthYearTo) && (
                  <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground border border-border/50">
                    <span className="font-semibold text-foreground">
                      {isAr ? "المواليد المعتمدة:" : "Années de naissance :"}
                    </span>
                    <span className="font-mono tabular-nums">
                      {team.birthYearFrom ?? "—"} {isAr ? "إلى" : "à"} {team.birthYearTo ?? "—"}
                    </span>
                  </div>
                )}

                {/* Team Category Chart */}
                <div className="my-4 rounded-xl border border-border/70 bg-background/50 p-3.5 shadow-2xs">
                  <TeamCategoryChart
                    playersByPosition={playersByPosition}
                    totalPlayers={team._count.players}
                    locale={locale}
                  />
                </div>
                <section className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3.5">
                    <div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${insuranceActive ? "bg-emerald-500/10 text-emerald-600" : insurancePending ? "bg-sky-500/10 text-sky-600" : "bg-amber-500/10 text-amber-600"}`}><ShieldCheck className="h-4.5 w-4.5" /></span><div><h3 className="text-sm font-bold">{isAr ? "تأمين الفئة" : "Assurance de la catégorie"}</h3><p className="mt-0.5 text-[10px] text-muted-foreground">{isAr ? "وثيقة جماعية تغطي لاعبي هذه الفئة" : "Police collective pour les joueurs de cette catégorie"}</p></div></div>
                    <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${insuranceActive ? "bg-emerald-500/10 text-emerald-600" : insurancePending ? "bg-sky-500/10 text-sky-600" : "bg-amber-500/10 text-amber-600"}`}>{insuranceLabel}</span>
                  </div>
                  <div className="space-y-4 p-4">
                    {insurance && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary"><FileCheck className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-xs font-semibold">{insurance.document.originalName}</p><p className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarDays className="h-3 w-3" />{insuranceDate(insurance.startDate)} — {insuranceDate(insurance.endDate)}</p></div></div>{insurance.document.id && <a href={`/api/documents/${insurance.document.id}/download?inline=true`} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-[11px] font-bold transition hover:border-primary/40 hover:text-primary">{isAr ? "معاينة الوثيقة" : "Voir le document"}</a>}</div>}
                    {insurance?.checkFindings && Array.isArray(insurance.checkFindings) && insurance.checkFindings.length > 0 && insurance.checkStatus !== "CHECKED" && <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-600">{isAr ? "نتيجة الفحص:" : "Résultat du contrôle :"} {insurance.checkFindings.join(" · ")}</p>}
                    {canManage && <form action={uploadTeamInsuranceAction.bind(null, team.id, locale)} encType="multipart/form-data" className="space-y-3 border-t border-border pt-4">
                      <div><h4 className="text-xs font-bold">{isAr ? "رفع أو تجديد وثيقة التأمين" : "Ajouter ou renouveler l’attestation"}</h4><p className="mt-1 text-[10px] text-muted-foreground">{isAr ? "سيطابق الفحص الآلي الوثيقة مع الفئة وفترة التغطية قبل اعتمادها." : "La vérification automatique comparera la catégorie et la période avant validation."}</p></div>
                      <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1.5 text-xs font-semibold"><span>{isAr ? "بداية التغطية" : "Début de couverture"}</span><DateInput name="startDate" required locale={locale} inputClassName="h-10 rounded-xl border-border bg-background text-xs" /></label><label className="block space-y-1.5 text-xs font-semibold"><span>{isAr ? "نهاية التغطية" : "Fin de couverture"}</span><DateInput name="endDate" required locale={locale} inputClassName="h-10 rounded-xl border-border bg-background text-xs" /></label></div>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><TeamInsuranceFileInput locale={locale} /><button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"><ShieldCheck className="h-4 w-4" />{isAr ? "رفع الوثيقة وفحصها" : "Téléverser et vérifier"}</button></div>
                    </form>}
                  </div>
                </section>
              </div>

              {/* Bottom Quick Metrics Strip & Navigation Links */}
              <div className="pt-3 border-t border-border/60">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Link
                    href={`/${locale}/dashboard/players?team=${team.id}`}
                    className="p-1.5 rounded-lg bg-muted/30 hover:bg-club-primary/10 hover:text-club-primary transition-colors group/item"
                  >
                    <span className="block text-[10px] font-bold text-muted-foreground group-hover/item:text-club-primary">
                      {isAr ? "اللاعبون" : "Joueurs"}
                    </span>
                    <span className="block font-mono text-base font-black text-foreground group-hover/item:text-club-primary">
                      {team._count.players}
                    </span>
                  </Link>

                  <Link
                    href={`/${locale}/dashboard/staff`}
                    className="p-1.5 rounded-lg bg-muted/30 hover:bg-blue-500/10 hover:text-blue-600 transition-colors group/item"
                  >
                    <span className="block text-[10px] font-bold text-muted-foreground group-hover/item:text-blue-600">
                      {isAr ? "الطاقم" : "Staff"}
                    </span>
                    <span className="block font-mono text-base font-black text-foreground group-hover/item:text-blue-600">
                      {team._count.staff}
                    </span>
                  </Link>

                  <Link
                    href={`/${locale}/dashboard/matches?team=${team.id}`}
                    className="p-1.5 rounded-lg bg-muted/30 hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors group/item"
                  >
                    <span className="block text-[10px] font-bold text-muted-foreground group-hover/item:text-emerald-600">
                      {isAr ? "المباريات" : "Matchs"}
                    </span>
                    <span className="block font-mono text-base font-black text-foreground group-hover/item:text-emerald-600">
                      {team._count.matches}
                    </span>
                  </Link>

                  <Link
                    href={`/${locale}/dashboard/contracts?team=${team.id}`}
                    className="p-1.5 rounded-lg bg-muted/30 hover:bg-purple-500/10 hover:text-purple-600 transition-colors group/item"
                  >
                    <span className="block text-[10px] font-bold text-muted-foreground group-hover/item:text-purple-600">
                      {isAr ? "العقود" : "Contrats"}
                    </span>
                    <span className="block font-mono text-base font-black text-foreground group-hover/item:text-purple-600">
                      {team._count.contracts}
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
