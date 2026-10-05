import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamCategoryChart } from "@/components/teams/team-category-chart";
import { ROSTER_PLAYER_STATUSES } from "@/lib/teams/roster";
import { Shield, Users, Trophy, FileCheck, ArrowRight, UserCog, Edit3 } from "lucide-react";

const CATEGORY_ORDER = ["SENIOR", "U20", "U17", "U15"] as const;

export default async function TeamsListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale === "ar";
  const user = await requirePermission("teams.view");
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
      }
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
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">{team.name}</p>
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
