import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, BarChart3, Crosshair, Footprints, ShieldAlert, Target, Trophy, Users } from "lucide-react";
import { FormSelect } from "@/components/ui/form-select";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { hasPermission, isProgrammer, requirePagePermission } from "@/lib/permissions";
import { OFFICIAL_CATEGORY_NAMES } from "@/lib/competitions/types";
import { estimateShotXg } from "@/lib/matches/xg";

type PlayerPerformance = {
  player: { id: string; slug: string; firstName: string; lastName: string; firstNameFr: string | null; lastNameFr: string | null; shirtNumber: number | null; team: { category: "SENIOR" | "U20" | "U17" | "U15" } | null };
  appearances: number;
  starts: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  xgShots: number;
  yellowCards: number;
  redCards: number;
};

const cardClass = "rounded-2xl border border-border bg-card p-4 shadow-xs";
const selectClass = "min-w-0 text-[10px] font-bold text-muted-foreground";

function categoryLabel(category: string | null | undefined, locale: string) {
  if (!category) return locale === "ar" ? "غير مصنف" : "Sans catégorie";
  return OFFICIAL_CATEGORY_NAMES[category as keyof typeof OFFICIAL_CATEGORY_NAMES]?.[locale === "fr" ? "fr" : "ar"] ?? category;
}

export default async function PlayerStatsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; season?: string; player?: string; page?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const isAr = locale !== "fr";
  const user = await requirePagePermission("player.stats.view", locale);
  const isCoach = user.roleKey === "coach" || user.roleKey === "assistant_coach";
  const isPrivileged = isProgrammer(user) || (user.roleKey === "super_admin" && hasPermission(user, "*"));
  if (!isCoach && !isPrivileged) redirect(`/${locale}/access-denied?code=403`);

  const allActiveTeams = await db.team.findMany({ where: { active: true }, select: { id: true, category: true, name: true }, orderBy: { category: "asc" } });
  let allowedCategories = new Set<string>();
  if (isCoach) {
    // UserTeam is the authorization source. A senior coach receives the
    // explicit sporting exception to view U20 performance as requested.
    const assignments = await db.userTeam.findMany({ where: { userId: user.id }, select: { team: { select: { category: true } } } });
    allowedCategories = new Set(assignments.map((assignment) => assignment.team.category));
    if (allowedCategories.has("SENIOR")) allowedCategories.add("U20");
  } else {
    allowedCategories = new Set(allActiveTeams.map((team) => team.category));
  }
  const allowedTeams = allActiveTeams.filter((team) => allowedCategories.has(team.category));
  const allowedTeamIds = allowedTeams.map((team) => team.id);
  const selectedCategory = allowedTeams.some((team) => team.category === query.category) ? query.category! : "ALL";
  const categoryTeamIds = selectedCategory === "ALL" ? allowedTeamIds : allowedTeams.filter((team) => team.category === selectedCategory).map((team) => team.id);

  const [seasons, currentSeason] = await Promise.all([
    db.season.findMany({
      where: { competitions: { some: { matches: { some: { teamId: { in: allowedTeamIds }, status: { in: ["LIVE", "FINISHED"] } } } } } },
      select: { id: true, label: true, startDate: true },
      orderBy: { startDate: "desc" }
    }),
    db.season.findFirst({ where: { isCurrent: true }, select: { id: true } })
  ]);
  const selectedSeasonId = query.season === "ALL" ? null : seasons.some((season) => season.id === query.season) ? query.season! : currentSeason?.id ?? seasons[0]?.id ?? null;
  const players = categoryTeamIds.length
    ? await db.player.findMany({
        where: { teamId: { in: categoryTeamIds } },
        select: { id: true, slug: true, firstName: true, lastName: true, firstNameFr: true, lastNameFr: true, shirtNumber: true, team: { select: { category: true } } },
        orderBy: [{ shirtNumber: "asc" }, { firstName: "asc" }, { lastName: "asc" }]
      })
    : [];
  const playerIds = players.map((player) => player.id);
  const matchFilter: Prisma.MatchWhereInput = {
    teamId: { in: categoryTeamIds },
    status: { in: ["LIVE", "FINISHED"] },
    ...(selectedSeasonId ? { competition: { seasonId: selectedSeasonId } } : {})
  };
  const [events, shots, lineups, shotMatches] = await Promise.all([
        db.matchEvent.findMany({
          where: { playerId: { in: playerIds }, match: matchFilter },
          select: { playerId: true, matchId: true, minute: true, type: true }
        }),
        db.playerShot.findMany({
          where: { playerId: { in: playerIds }, match: matchFilter },
          select: { playerId: true, assistPlayerId: true, outcome: true, xG: true, bodyPart: true, situation: true, x: true, y: true, minute: true, matchId: true },
          orderBy: [{ createdAt: "desc" }, { minute: "desc" }]
        }),
        db.matchLineup.findMany({
          where: { playerId: { in: playerIds }, match: matchFilter },
          select: { playerId: true, matchId: true, isStarting: true }
        }),
        db.match.findMany({
          where: matchFilter,
          select: { id: true, matchDate: true, homeTeamName: true, awayTeamName: true },
          orderBy: { matchDate: "desc" }
        })
      ]);

  const rows = new Map<string, PlayerPerformance>(players.map((player) => [player.id, {
    player,
    appearances: 0,
    starts: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
    xgShots: 0,
    yellowCards: 0,
    redCards: 0
  }]));
  for (const lineup of lineups) {
    const row = rows.get(lineup.playerId);
    if (!row) continue;
    row.appearances += 1;
    if (lineup.isStarting) row.starts += 1;
  }
  const linkedAssistKeys = new Set(shots.filter((shot) => shot.assistPlayerId && shot.outcome === "GOAL").map((shot) => `${shot.matchId}:${shot.assistPlayerId}:${shot.minute}`));
  for (const event of events) {
    if (!event.playerId) continue;
    const row = rows.get(event.playerId);
    if (!row) continue;
    if (event.type === "GOAL" || event.type === "PENALTY_GOAL") row.goals += 1;
    if (event.type === "ASSIST" && !linkedAssistKeys.has(`${event.matchId}:${event.playerId}:${event.minute}`)) row.assists += 1;
    if (event.type === "YELLOW_CARD") row.yellowCards += 1;
    if (event.type === "RED_CARD") row.redCards += 1;
  }
  for (const shot of shots) {
    const shooter = shot.playerId ? rows.get(shot.playerId) : null;
    if (shooter) {
      shooter.shots += 1;
      if (["GOAL", "SAVED"].includes(shot.outcome)) shooter.shotsOnTarget += 1;
      const shotXg = estimateShotXg({ x: shot.x, y: shot.y, bodyPart: shot.bodyPart, situation: shot.situation });
      if (shotXg !== null) {
        shooter.xg += shotXg;
        shooter.xgShots += 1;
      }
    }
    const assister = shot.assistPlayerId ? rows.get(shot.assistPlayerId) : null;
    if (assister && shot.outcome === "GOAL") assister.assists += 1;
  }
  const rankedPlayers = [...rows.values()].sort((left, right) => right.goals - left.goals || right.xg - left.xg || right.assists - left.assists || right.appearances - left.appearances);
  const pageSize = 20;
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const pageCount = Math.max(1, Math.ceil(rankedPlayers.length / pageSize));
  const currentPage = Number.isFinite(requestedPage) ? Math.min(pageCount, Math.max(1, requestedPage)) : 1;
  const pagePlayers = rankedPlayers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageHref = (page: number) => `/${locale}/dashboard/player-stats?${new URLSearchParams({ ...(selectedCategory !== "ALL" ? { category: selectedCategory } : {}), ...(selectedSeasonId ? { season: selectedSeasonId } : {}), page: String(page) }).toString()}`;
  const selectedPlayer = rankedPlayers.find((row) => row.player.id === query.player) ?? null;
  const matchInfoById = new Map(shotMatches.map((match) => [match.id, match]));
  const selectedPlayerShots = selectedPlayer
    ? shots.filter((shot) => shot.playerId === selectedPlayer.player.id).map((shot) => ({ ...shot, xG: estimateShotXg({ x: shot.x, y: shot.y, bodyPart: shot.bodyPart, situation: shot.situation }), match: matchInfoById.get(shot.matchId)! }))
    : [];
  const locatedShots = selectedPlayerShots.filter((shot) => shot.x !== null && shot.y !== null && Number.isFinite(shot.x) && Number.isFinite(shot.y));
  const rightFootShots = selectedPlayerShots.filter((shot) => shot.bodyPart === "RIGHT_FOOT").length;
  const leftFootShots = selectedPlayerShots.filter((shot) => shot.bodyPart === "LEFT_FOOT").length;
  const headShots = selectedPlayerShots.filter((shot) => shot.bodyPart === "HEAD").length;
  const recordedGoals = selectedPlayerShots.filter((shot) => shot.outcome === "GOAL");
  const rightFootGoals = recordedGoals.filter((shot) => shot.bodyPart === "RIGHT_FOOT").length;
  const leftFootGoals = recordedGoals.filter((shot) => shot.bodyPart === "LEFT_FOOT").length;
  const headGoals = recordedGoals.filter((shot) => shot.bodyPart === "HEAD").length;
  const otherGoals = recordedGoals.filter((shot) => shot.bodyPart === "OTHER").length;
  const shotHeatCells = new Map<string, { x: number; y: number; count: number }>();
  for (const shot of locatedShots) {
    const x = Math.min(99, Math.max(1, Math.floor(shot.x! / 5) * 5 + 2.5));
    const rawY = Math.min(99, Math.max(1, Math.floor(shot.y! / 5) * 5 + 2.5));
    const y = rawY * 0.64;
    const key = `${x}:${y}`;
    const cell = shotHeatCells.get(key);
    if (cell) cell.count += 1;
    else shotHeatCells.set(key, { x, y, count: 1 });
  }
  const playerStatsListHref = `/${locale}/dashboard/player-stats?${new URLSearchParams({ ...(selectedCategory !== "ALL" ? { category: selectedCategory } : {}), ...(selectedSeasonId ? { season: selectedSeasonId } : {}) }).toString()}`;
  const totals = rankedPlayers.reduce((sum, row) => ({
    appearances: sum.appearances + row.appearances,
    goals: sum.goals + row.goals,
    assists: sum.assists + row.assists,
    xg: sum.xg + row.xg,
    xgShots: sum.xgShots + row.xgShots,
    shots: sum.shots + row.shots,
    cards: sum.cards + row.yellowCards + row.redCards
  }), { appearances: 0, goals: 0, assists: 0, xg: 0, xgShots: 0, shots: 0, cards: 0 });
  const seasonLabel = seasons.find((season) => season.id === selectedSeasonId)?.label;

  return <main className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-7" dir={isAr ? "rtl" : "ltr"}>
    <header className="relative z-20 overflow-visible rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-club-primary" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-club-primary"><BarChart3 className="size-4" /><span className="text-[10px] font-black tracking-wide">{isAr ? "الأداء الفني" : "PERFORMANCE"}</span></div>
          <h1 className="mt-2 text-2xl font-black">{selectedPlayer ? (isAr ? "تحليل اللاعب" : "Analyse du joueur") : (isAr ? "إحصائيات اللاعبين" : "Statistiques joueurs")}</h1>
          <p className="mt-1 max-w-2xl text-xs leading-6 text-muted-foreground">{selectedPlayer ? (isAr ? "عرض كامل لأداء اللاعب وتسديداته المسجلة ضمن الفئة والموسم المحددين." : "Vue complète des performances et tirs enregistrés pour la catégorie et la saison sélectionnées.") : (isAr ? "الأهداف، التمريرات الحاسمة، التسديدات، xG والانضباط — تُبنى مباشرة من أحداث المباريات والتشكيلات المسجلة." : "Buts, passes décisives, tirs, xG et discipline — calculés depuis les événements et compositions des matchs.")}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-club-primary/20 bg-club-primary/5 px-3 py-2 text-[10px] font-bold text-club-primary"><Users className="size-3.5" />{isCoach ? (isAr ? "الفئات المسندة إليك" : "Vos catégories attribuées") : (isAr ? "عرض إداري" : "Vue administrateur")}</span>
      </div>
      <form method="get" className={`mt-5 grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 sm:items-end ${selectedPlayer ? "sm:grid-cols-[1fr_auto]" : "sm:grid-cols-[1fr_1fr_auto]"}`}>
        {selectedPlayer ? <input type="hidden" name="category" value={selectedCategory} /> : <label className={selectClass}><span className="mb-1.5 block">{isAr ? "الفئة" : "Catégorie"}</span><FormSelect locale={locale} name="category" defaultValue={selectedCategory} compact options={[{ value: "ALL", label: isAr ? "كل الفئات المسموحة" : "Toutes vos catégories" }, ...allowedTeams.map((team) => ({ value: team.category, label: categoryLabel(team.category, locale) }))]} triggerClassName="!h-10 !text-xs" /></label>}
        <label className={selectClass}><span className="mb-1.5 block">{isAr ? "الموسم" : "Saison"}</span><FormSelect locale={locale} name="season" defaultValue={selectedSeasonId ?? "ALL"} compact options={[{ value: "ALL", label: isAr ? "كل المواسم" : "Toutes les saisons" }, ...seasons.map((season) => ({ value: season.id, label: season.label }))]} triggerClassName="!h-10 !text-xs" /></label>
        {selectedPlayer && <input type="hidden" name="player" value={selectedPlayer.player.id} />}
        <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-club-primary px-4 text-xs font-bold text-white transition hover:bg-club-primary-hover"><Activity className="size-3.5" />{isAr ? "عرض الإحصائيات" : "Afficher"}</button>
      </form>
    </header>

    {selectedPlayer ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className={cardClass}><div className="text-xs text-muted-foreground">{isAr ? "مشاركات" : "Apparitions"}</div><p className="mt-3 text-2xl font-black tabular-nums">{selectedPlayer.appearances}</p></div>
      <div className={cardClass}><div className="text-xs text-muted-foreground">{isAr ? "مباريات أساسي" : "Titularisations"}</div><p className="mt-3 text-2xl font-black tabular-nums">{selectedPlayer.starts}</p></div>
      <div className={cardClass}><div className="text-xs text-muted-foreground">{isAr ? "الأهداف / التمريرات الحاسمة" : "Buts / passes décisives"}</div><p className="mt-3 text-2xl font-black tabular-nums">{selectedPlayer.goals} / {selectedPlayer.assists}</p></div>
      <div className={cardClass}><div className="text-xs text-muted-foreground">xG {isAr ? "(تغطية التسديدات المسجلة)" : "(tirs renseignés)"}</div><p className="mt-3 text-2xl font-black tabular-nums">{selectedPlayer.xg.toFixed(2)}</p><p className="mt-1 text-[10px] text-muted-foreground">{selectedPlayer.xgShots} / {selectedPlayer.shots} {isAr ? "تسديدة" : "tirs"}</p></div>
      <div className={cardClass}><div className="text-xs text-muted-foreground">{isAr ? "التسديدات" : "Tirs"}</div><p className="mt-3 text-2xl font-black tabular-nums">{selectedPlayer.shots}</p></div>
      <div className={cardClass}><div className="text-xs text-muted-foreground">{isAr ? "على المرمى" : "Cadrés"}</div><p className="mt-3 text-2xl font-black tabular-nums">{selectedPlayer.shotsOnTarget} / {selectedPlayer.shots}</p></div>
      <div className={cardClass}><div className="text-xs text-muted-foreground">{isAr ? "بطاقات صفراء" : "Cartons jaunes"}</div><p className="mt-3 text-2xl font-black tabular-nums">{selectedPlayer.yellowCards}</p></div>
      <div className={cardClass}><div className="text-xs text-muted-foreground">{isAr ? "بطاقات حمراء" : "Cartons rouges"}</div><p className="mt-3 text-2xl font-black tabular-nums">{selectedPlayer.redCards}</p></div>
    </section> : <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className={cardClass}><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{isAr ? "مشاركات اللاعبين" : "Apparitions"}</span><Users className="size-4 text-sky-500" /></div><p className="mt-3 text-2xl font-black tabular-nums">{totals.appearances}</p><p className="mt-1 text-[10px] text-muted-foreground">{seasonLabel ?? (isAr ? "كل المواسم" : "Toutes saisons")}</p></div>
      <div className={cardClass}><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{isAr ? "الأهداف" : "Buts"}</span><Trophy className="size-4 text-amber-500" /></div><p className="mt-3 text-2xl font-black tabular-nums">{totals.goals}</p><p className="mt-1 text-[10px] text-muted-foreground">{isAr ? "الأهداف المسجلة للاعبين" : "Buts des joueurs"}</p></div>
      <div className={cardClass}><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{isAr ? "xG المتوقع" : "xG attendu"}</span><Target className="size-4 text-club-primary" /></div><p className="mt-3 text-2xl font-black tabular-nums">{totals.xg.toFixed(2)}</p><p className="mt-1 text-[10px] text-muted-foreground">{totals.xgShots} / {totals.shots} {isAr ? "تسديدة لها موقع مسجل" : "tirs avec position"}</p></div>
      <div className={cardClass}><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{isAr ? "البطاقات" : "Cartons"}</span><ShieldAlert className="size-4 text-rose-500" /></div><p className="mt-3 text-2xl font-black tabular-nums">{totals.cards}</p><p className="mt-1 text-[10px] text-muted-foreground">{isAr ? "صفراء وحمراء" : "Jaunes et rouges"}</p></div>
    </section>}

    {!selectedPlayer && <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div><h2 className="text-sm font-extrabold">{isAr ? "ترتيب لاعبي الفئة" : "Classement de la catégorie"}</h2><p className="mt-1 text-[10px] text-muted-foreground">{isAr ? "اختر لاعبًا لعرض خريطة تسديداته ومبارياته المسجلة." : "Sélectionnez un joueur pour voir sa carte des tirs et ses matchs."}</p></div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{rankedPlayers.length} {isAr ? "لاعب" : "joueurs"}</span>
      </div>
      {rankedPlayers.length === 0 ? <div className="px-4 py-12 text-center"><Footprints className="mx-auto size-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-bold">{isAr ? "لا توجد بيانات لهذه الفئة أو لهذا الموسم" : "Aucune donnée pour cette catégorie ou cette saison"}</p><p className="mt-1 text-xs text-muted-foreground">{isAr ? "تظهر الإحصائيات بعد تسجيل التشكيلات وأحداث المباريات." : "Les statistiques apparaissent après l’enregistrement des compositions et événements."}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-start text-xs">
        <thead className="bg-muted/40 text-[10px] font-bold text-muted-foreground"><tr>
          <th className="px-4 py-3 text-start"># / {isAr ? "اللاعب" : "Joueur"}</th><th className="px-3 py-3 text-center">{isAr ? "مباريات" : "MJ"}</th><th className="px-3 py-3 text-center">⚽</th><th className="px-3 py-3 text-center">{isAr ? "تمريرات حاسمة" : "PD"}</th><th className="px-3 py-3 text-center">{isAr ? "تسديدات" : "Tirs"}</th><th className="px-3 py-3 text-center">xG</th><th className="px-3 py-3 text-center">{isAr ? "دقة التسديد" : "Cadrés"}</th><th className="px-3 py-3 text-center">🟨</th><th className="px-3 py-3 text-center">🟥</th><th className="px-4 py-3 text-end">{isAr ? "تحليل" : "Analyse"}</th>
        </tr></thead>
        <tbody className="divide-y divide-border/80">{pagePlayers.map((row, index) => {
          const href = `/${locale}/dashboard/player-stats?${new URLSearchParams({ ...(selectedCategory !== "ALL" ? { category: selectedCategory } : {}), ...(selectedSeasonId ? { season: selectedSeasonId } : {}), player: row.player.id }).toString()}`;
          return <tr key={row.player.id} className="transition-colors hover:bg-muted/30">
            <td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-[10px] font-bold text-muted-foreground">{row.player.shirtNumber ?? (currentPage - 1) * pageSize + index + 1}</span><span className="min-w-0"><span className="block truncate font-bold">{locale === "fr" ? `${row.player.firstNameFr || row.player.firstName} ${row.player.lastNameFr || row.player.lastName}` : `${row.player.firstName} ${row.player.lastName}`}</span><span className="mt-0.5 block text-[9px] text-muted-foreground">{categoryLabel(row.player.team?.category, locale)} · {row.starts} {isAr ? "أساسي" : "titul."}</span></span></div></td>
            <td className="px-3 py-3 text-center tabular-nums">{row.appearances}</td><td className="px-3 py-3 text-center font-black tabular-nums">{row.goals}</td><td className="px-3 py-3 text-center tabular-nums">{row.assists}</td><td className="px-3 py-3 text-center tabular-nums">{row.shots}</td><td className="px-3 py-3 text-center font-bold tabular-nums">{row.xg.toFixed(2)}</td><td className="px-3 py-3 text-center tabular-nums">{row.shotsOnTarget}/{row.shots}</td><td className="px-3 py-3 text-center tabular-nums">{row.yellowCards}</td><td className="px-3 py-3 text-center tabular-nums">{row.redCards}</td><td className="px-4 py-3 text-end"><Link href={href} className="inline-flex items-center justify-center rounded-lg border border-club-primary/30 px-3 py-2 text-[10px] font-bold text-club-primary transition hover:border-club-primary hover:bg-club-primary/10">{isAr ? "عرض التحليل" : "Voir l’analyse"}</Link></td>
          </tr>;
        })}</tbody>
      </table></div>}
      {rankedPlayers.length > pageSize && <nav aria-label={isAr ? "صفحات ترتيب اللاعبين" : "Pages du classement"} className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="text-[10px] text-muted-foreground">{isAr ? `عرض ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, rankedPlayers.length)} من ${rankedPlayers.length} لاعب` : `Affichage de ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, rankedPlayers.length)} sur ${rankedPlayers.length} joueurs`}</span>
        <div className="flex items-center gap-2">
          {currentPage > 1 ? <Link href={pageHref(currentPage - 1)} className="rounded-lg border border-border px-3 py-2 text-[10px] font-bold transition hover:border-club-primary hover:text-club-primary">{isAr ? "السابق" : "Précédent"}</Link> : <span aria-disabled="true" className="rounded-lg border border-border/60 px-3 py-2 text-[10px] font-bold text-muted-foreground/50">{isAr ? "السابق" : "Précédent"}</span>}
          <span className="min-w-16 text-center text-[10px] font-bold tabular-nums text-muted-foreground">{currentPage} / {pageCount}</span>
          {currentPage < pageCount ? <Link href={pageHref(currentPage + 1)} className="rounded-lg border border-border px-3 py-2 text-[10px] font-bold transition hover:border-club-primary hover:text-club-primary">{isAr ? "التالي" : "Suivant"}</Link> : <span aria-disabled="true" className="rounded-lg border border-border/60 px-3 py-2 text-[10px] font-bold text-muted-foreground/50">{isAr ? "التالي" : "Suivant"}</span>}
        </div>
      </nav>}
    </section>}

    {selectedPlayer && <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div><p className="text-[10px] font-bold text-club-primary">{isAr ? "ملف الأداء" : "PROFIL DE PERFORMANCE"}</p><h2 className="mt-1 text-xl font-black">{locale === "fr" ? `${selectedPlayer.player.firstNameFr || selectedPlayer.player.firstName} ${selectedPlayer.player.lastNameFr || selectedPlayer.player.lastName}` : `${selectedPlayer.player.firstName} ${selectedPlayer.player.lastName}`}</h2><p className="mt-1 text-xs text-muted-foreground">{categoryLabel(selectedPlayer.player.team?.category, locale)} · #{selectedPlayer.player.shirtNumber ?? "—"}</p></div>
        <div className="flex flex-wrap gap-2"><Link href={playerStatsListHref} className="rounded-lg border border-border px-3 py-2 text-xs font-bold transition hover:border-club-primary hover:text-club-primary">{isAr ? "العودة إلى ترتيب اللاعبين" : "Retour au classement"}</Link><Link href={`/${locale}/dashboard/players/${selectedPlayer.player.id}`} className="rounded-lg bg-club-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-club-primary-hover">{isAr ? "ملف اللاعب" : "Fiche joueur"}</Link></div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className={`${cardClass} min-w-0 space-y-3`}><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-extrabold">{isAr ? "خريطة التسديدات" : "Carte des tirs"}</h3><span className="text-[10px] text-muted-foreground">{locatedShots.length} / {selectedPlayerShots.length} {isAr ? "بموقع مسجل" : "localisés"}</span></div>
          <div className="relative w-full overflow-hidden rounded-xl border border-emerald-300/30 bg-emerald-950/90 shadow-inner shadow-black/30" style={{ aspectRatio: "100 / 64" }}>
          <svg viewBox="0 0 100 64" preserveAspectRatio="xMidYMid meet" role="img" aria-label={isAr ? "خريطة حرارية لمواقع تسديد اللاعب" : "Carte thermique des tirs du joueur"} className="absolute inset-0 h-full w-full text-white">
            <defs><radialGradient id="shot-heat-gradient"><stop offset="0%" stopColor="#ef4444" stopOpacity=".95" /><stop offset="32%" stopColor="#f97316" stopOpacity=".8" /><stop offset="66%" stopColor="#facc15" stopOpacity=".42" /><stop offset="100%" stopColor="#facc15" stopOpacity="0" /></radialGradient></defs>
            <rect x="1" y="1" width="98" height="62" fill="none" stroke="currentColor" strokeOpacity=".7" strokeWidth=".45" />
            <line x1="50" y1="1" x2="50" y2="63" stroke="currentColor" strokeOpacity=".55" strokeWidth=".4" />
            <circle cx="50" cy="32" r="8" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth=".4" />
            <circle cx="50" cy="32" r=".55" fill="currentColor" fillOpacity=".7" />
            <rect x="1" y="18" width="21" height="28" fill="none" stroke="currentColor" strokeOpacity=".7" strokeWidth=".4" />
            <rect x="1" y="25" width="9" height="14" fill="none" stroke="currentColor" strokeOpacity=".7" strokeWidth=".4" />
            <path d="M22 26 A7 7 0 0 1 22 38" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth=".35" />
            <rect x="78" y="18" width="21" height="28" fill="none" stroke="currentColor" strokeOpacity=".7" strokeWidth=".4" />
            <rect x="90" y="25" width="9" height="14" fill="none" stroke="currentColor" strokeOpacity=".7" strokeWidth=".4" />
            <path d="M78 26 A7 7 0 0 0 78 38" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth=".35" />
            <rect x=".25" y="28" width="1.5" height="8" fill="none" stroke="currentColor" strokeOpacity=".8" strokeWidth=".35" />
            <rect x="98.25" y="28" width="1.5" height="8" fill="none" stroke="currentColor" strokeOpacity=".8" strokeWidth=".35" />
            {locatedShots.length >= 8 ? [...shotHeatCells.values()].map((cell) => <circle key={`${cell.x}:${cell.y}`} cx={cell.x} cy={cell.y} r={Math.min(8, 4.5 + cell.count * 0.45)} fill="url(#shot-heat-gradient)" opacity={Math.min(0.5 + cell.count * 0.12, 0.95)} />) : locatedShots.map((shot, index) => <circle key={`${shot.matchId}-${shot.minute}-${index}`} cx={shot.x!} cy={(shot.y! * 64) / 100} r={shot.outcome === "GOAL" ? 1.8 : 1.35} fill={shot.outcome === "GOAL" ? "#22c55e" : shot.outcome === "SAVED" ? "#38bdf8" : "#f97316"} stroke="white" strokeWidth=".5" />)}
          </svg>
          </div>
          <p className="flex items-center gap-1 text-[10px] leading-5 text-muted-foreground"><Crosshair className="size-3 shrink-0" />{isAr ? (locatedShots.length >= 8 ? "كلما زاد تركّز اللون ارتفع عدد التسديدات من تلك المنطقة. المواقع تقريبية من إدخال المباراة." : "أخضر: هدف · أزرق: تصدٍ · برتقالي: غير ذلك. تتحول الخريطة تلقائيًا إلى حرارية عند كثرة التسديدات.") : (locatedShots.length >= 8 ? "La couleur la plus dense indique davantage de tirs depuis cette zone. Positions approximatives saisies pendant le match." : "Vert : but · bleu : arrêt · orange : autre. La carte devient thermique quand les tirs se multiplient.")}</p>
        </div>
        <div className={`${cardClass} min-w-0 space-y-2`}><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-extrabold">{isAr ? "كل التسديدات المسجلة" : "Tous les tirs enregistrés"}</h3><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">{selectedPlayerShots.length}</span></div>{selectedPlayerShots.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">{isAr ? "لم تسجل تسديدات بعد لهذا اللاعب." : "Aucun tir enregistré pour ce joueur."}</p> : <ul className="max-h-[34rem] divide-y divide-border/70 overflow-y-auto pe-1">{selectedPlayerShots.map((shot, index) => <li key={`${shot.matchId}-${shot.minute}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-[10px]"><span className="min-w-0"><span className="block truncate font-bold">{shot.match.homeTeamName} – {shot.match.awayTeamName}</span><span className="mt-0.5 block text-muted-foreground">{shot.minute}{"'"} · {shot.bodyPart === "RIGHT_FOOT" ? (isAr ? "القدم اليمنى" : "Pied droit") : shot.bodyPart === "LEFT_FOOT" ? (isAr ? "القدم اليسرى" : "Pied gauche") : shot.bodyPart === "HEAD" ? (isAr ? "الرأس" : "Tête") : isAr ? "غير محدد" : "Non précisé"}{shot.x === null || shot.y === null ? (isAr ? " · الموقع غير مسجل" : " · position non renseignée") : ""}</span></span><span className="shrink-0 text-end"><span className="block font-bold">{shot.xG === null ? "—" : shot.xG.toFixed(2)} xG</span><span className="text-muted-foreground">{shot.outcome === "GOAL" ? (isAr ? "هدف" : "But") : shot.outcome === "SAVED" ? (isAr ? "تصدٍ" : "Arrêt") : shot.outcome === "BLOCKED" ? (isAr ? "مصدودة" : "Contré") : shot.outcome === "WOODWORK" ? (isAr ? "قائم/عارضة" : "Poteau/barre") : isAr ? "خارج المرمى" : "Hors cadre"}</span></span></li>)}</ul>}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className={cardClass}><div className="text-xs text-muted-foreground">{isAr ? "الفرق بين الأهداف وxG" : "Buts − xG"}</div><p className="mt-3 text-xl font-black tabular-nums">{(selectedPlayer.goals - selectedPlayer.xg).toFixed(2)}</p></div>
        <div className={cardClass}><div className="text-xs text-muted-foreground">{isAr ? "تسديدات بالقدم" : "Tirs du pied"}</div><p className="mt-3 text-xl font-black tabular-nums">{rightFootShots} <span className="text-xs font-medium text-muted-foreground">{isAr ? "يمين" : "droit"}</span> / {leftFootShots} <span className="text-xs font-medium text-muted-foreground">{isAr ? "يسار" : "gauche"}</span></p></div>
        <div className={cardClass}><div className="text-xs text-muted-foreground">{isAr ? "تسديدات بالرأس" : "Tirs de la tête"}</div><p className="mt-3 text-xl font-black tabular-nums">{headShots}</p></div>
        <div className={cardClass}><div className="text-xs text-muted-foreground">{isAr ? "نسبة التسديدات على المرمى" : "Tirs cadrés"}</div><p className="mt-3 text-xl font-black tabular-nums">{selectedPlayer.shots ? `${Math.round((selectedPlayer.shotsOnTarget / selectedPlayer.shots) * 100)}%` : "—"}</p></div>
        <div className={`${cardClass} sm:col-span-2 xl:col-span-2`}>
          <div className="text-xs font-bold text-muted-foreground">{isAr ? "الأهداف حسب طريقة التسجيل" : "Buts selon la finition"}</div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div><p className="text-lg font-black tabular-nums">{rightFootGoals}</p><p className="text-[10px] text-muted-foreground">{isAr ? "يمين" : "Droit"}</p></div>
            <div><p className="text-lg font-black tabular-nums">{leftFootGoals}</p><p className="text-[10px] text-muted-foreground">{isAr ? "يسار" : "Gauche"}</p></div>
            <div><p className="text-lg font-black tabular-nums">{headGoals}</p><p className="text-[10px] text-muted-foreground">{isAr ? "رأس" : "Tête"}</p></div>
            <div><p className="text-lg font-black tabular-nums">{otherGoals}</p><p className="text-[10px] text-muted-foreground">{isAr ? "أخرى" : "Autre"}</p></div>
          </div>
          {recordedGoals.length < selectedPlayer.goals && <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">{selectedPlayer.goals - recordedGoals.length} {isAr ? "هدف دون طريقة تسجيل مسجلة" : "but(s) sans finition renseignée"}</p>}
        </div>
      </div>
    </section>}

  </main>;
}
