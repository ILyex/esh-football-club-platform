import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamCategoryChart } from "@/components/teams/team-category-chart";
import { ROSTER_PLAYER_STATUSES } from "@/lib/teams/roster";
import { localizedClubName } from "@/lib/public/locale-text";
import { CalendarDays, ChevronLeft, ChevronRight, Edit3, Shield, Trophy, UserCog, Users } from "lucide-react";

const CATEGORY_ORDER = ["SENIOR", "U20", "U17", "U15"] as const;

export default async function TeamsListPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  const { category: requestedCategory } = await searchParams;
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
      }
    }
  });

  const sorted = [...teams].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category as (typeof CATEGORY_ORDER)[number]) - CATEGORY_ORDER.indexOf(b.category as (typeof CATEGORY_ORDER)[number])
  );
  const selectedIndex = Math.max(0, sorted.findIndex((team) => team.category === requestedCategory));
  const selected = sorted[selectedIndex];
  const pageHref = (index: number) => `/${locale}/dashboard/teams?category=${encodeURIComponent(sorted[index]!.category)}`;

  const positionCounts: Record<string, number> = {};
  for (const player of selected?.players ?? []) {
    positionCounts[player.position] = (positionCounts[player.position] ?? 0) + 1;
  }
  const playersByPosition = Object.entries(positionCounts).map(([position, count]) => ({ position, count }));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {isAr ? "اختر الفئة لعرض لاعبيها وطاقمها ومبارياتها في صفحة مستقلة." : "Choisissez une catégorie pour consulter son effectif, son staff et ses matchs sur une page dédiée."}
        </p>
      </header>

      <nav aria-label={isAr ? "صفحات الفئات" : "Pages des catégories"} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sorted.map((team, index) => {
          const active = index === selectedIndex;
          return (
            <Link
              key={team.id}
              href={pageHref(index)}
              aria-current={active ? "page" : undefined}
              className={`rounded-xl border px-4 py-3 transition-colors ${active ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/40"}`}
            >
              <span className="block text-sm font-bold">{t(`categories.${team.category}` as any)}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {team._count.players} {isAr ? "لاعب" : "joueurs"} · {team._count.staff} {isAr ? "طاقم" : "staff"}
              </span>
            </Link>
          );
        })}
      </nav>

      {selected ? (
        <section aria-labelledby="selected-category-title" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/20 p-4 sm:p-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Shield className="h-6 w-6" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="selected-category-title" className="text-lg font-bold">{t(`categories.${selected.category}` as any)}</h2>
                  <Badge tone={selected.active ? "success" : "neutral"}>{selected.active ? (isAr ? "نشطة" : "Active") : (isAr ? "غير نشطة" : "Inactive")}</Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">{localizedClubName(selected.name, locale, t(`categories.${selected.category}` as any))}</p>
              </div>
            </div>
            {canManage && <Link href={`/${locale}/dashboard/teams/${selected.id}`}><Button variant="outline" size="sm" className="gap-2"><Edit3 className="h-4 w-4" />{tCommon("edit")}</Button></Link>}
          </div>

          <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="space-y-4">
              {(selected.birthYearFrom || selected.birthYearTo) && <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm"><CalendarDays className="h-4 w-4 text-primary" /><span className="font-semibold">{isAr ? "الفئة العمرية:" : "Années de naissance :"}</span><span className="tabular-nums">{selected.birthYearFrom ?? "—"} {isAr ? "إلى" : "à"} {selected.birthYearTo ?? "—"}</span></div>}
              <div className="grid grid-cols-2 gap-3">
                <Metric href={`/${locale}/dashboard/players?team=${selected.id}`} icon={<Users className="h-4 w-4" />} label={isAr ? "اللاعبون" : "Joueurs"} value={selected._count.players} />
                <Metric href={`/${locale}/dashboard/staff?team=${selected.id}`} icon={<UserCog className="h-4 w-4" />} label={isAr ? "الطاقم" : "Staff"} value={selected._count.staff} />
                <Metric href={`/${locale}/dashboard/matches?team=${selected.id}`} icon={<Trophy className="h-4 w-4" />} label={isAr ? "المباريات" : "Matchs"} value={selected._count.matches} />
                <Metric href={`/${locale}/dashboard/contracts?team=${selected.id}`} icon={<CalendarDays className="h-4 w-4" />} label={isAr ? "العقود" : "Contrats"} value={selected._count.contracts} />
              </div>
            </div>
            <div className="min-h-64 rounded-xl border border-border/70 bg-background/50 p-4">
              <h3 className="mb-2 text-sm font-bold">{isAr ? "توزيع اللاعبين حسب المركز" : "Joueurs par poste"}</h3>
              <TeamCategoryChart playersByPosition={playersByPosition} totalPlayers={selected._count.players} locale={locale} />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
            {selectedIndex > 0 ? <Link href={pageHref(selectedIndex - 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronLeft className="h-4 w-4" />{isAr ? "الفئة السابقة" : "Précédente"}</Link> : <span />}
            <span className="text-xs tabular-nums text-muted-foreground">{selectedIndex + 1} / {sorted.length}</span>
            {selectedIndex < sorted.length - 1 ? <Link href={pageHref(selectedIndex + 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">{isAr ? "الفئة التالية" : "Suivante"}<ChevronRight className="h-4 w-4" /></Link> : <span />}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{isAr ? "لا توجد فئات متاحة." : "Aucune catégorie disponible."}</div>
      )}
    </div>
  );
}

function Metric({ href, icon, label, value }: { href: string; icon: React.ReactNode; label: string; value: number }) {
  return <Link href={href} className="rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"><span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">{icon}{label}</span><span className="mt-2 block text-2xl font-black tabular-nums">{value}</span></Link>;
}
