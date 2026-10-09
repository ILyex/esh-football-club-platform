"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CircleDot, Goal, ShieldCheck, Target, UsersRound } from "lucide-react";
import type { PublicLineupItem } from "@/lib/public/matches";
import { SafeImage } from "@/components/shared/safe-image";

type PositionKey = "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD";
type PositionGroup = { key: PositionKey; icon: typeof Goal; ar: string; fr: string };

const POSITION_GROUPS: PositionGroup[] = [
  { key: "GOALKEEPER", icon: Goal, ar: "حراس المرمى", fr: "Gardiens" },
  { key: "DEFENDER", icon: ShieldCheck, ar: "المدافعون", fr: "Défenseurs" },
  { key: "MIDFIELDER", icon: CircleDot, ar: "وسط الميدان", fr: "Milieux" },
  { key: "FORWARD", icon: Target, ar: "المهاجمون", fr: "Attaquants" }
];

function positionGroup(position: string | null): PositionKey {
  const value = (position || "").trim().toUpperCase();
  if (["GOALKEEPER", "GK", "G", "GARDIEN"].includes(value) || value.includes("حارس")) return "GOALKEEPER";
  if (["DEFENDER", "CB", "LB", "RB", "DC", "DL", "DR"].includes(value) || value.includes("دفاع") || value.includes("مدافع")) return "DEFENDER";
  if (["MIDFIELDER", "DM", "CM", "AM", "MF", "MDF", "MC", "MO"].includes(value) || value.includes("وسط")) return "MIDFIELDER";
  if (["FORWARD", "ST", "CF", "LW", "RW", "FW", "AC", "AL", "AR"].includes(value) || value.includes("مهاجم") || value.includes("جناح")) return "FORWARD";
  return "MIDFIELDER";
}

function PositionCarousel({
  players,
  title,
  locale,
  categorySlug
}: {
  players: PublicLineupItem[];
  title: string;
  locale: string;
  categorySlug: string;
}) {
  const isArabic = locale === "ar";
  const touchStartX = useRef<number | null>(null);
  const counts = useMemo(() => Object.fromEntries(
    POSITION_GROUPS.map((group) => [group.key, players.filter((player) => positionGroup(player.position) === group.key).length])
  ) as Record<PositionKey, number>, [players]);
  const availableGroups = useMemo(() => POSITION_GROUPS.filter((group) => counts[group.key] > 0), [counts]);
  const [position, setPosition] = useState<PositionKey>(() =>
    POSITION_GROUPS.find((group) => players.some((player) => positionGroup(player.position) === group.key))?.key ?? "GOALKEEPER"
  );
  const selectedGroup = POSITION_GROUPS.find((group) => group.key === position)!;
  const shownPlayers = players.filter((player) => positionGroup(player.position) === position);

  const movePosition = useCallback((direction: 1 | -1) => {
    if (availableGroups.length < 2) return;
    setPosition((current) => {
      const currentIndex = availableGroups.findIndex((group) => group.key === current);
      const nextIndex = (currentIndex + direction + availableGroups.length) % availableGroups.length;
      return availableGroups[nextIndex]?.key ?? availableGroups[0]!.key;
    });
  }, [availableGroups]);

  useEffect(() => {
    if (availableGroups.length < 2) return;
    const timer = window.setInterval(() => movePosition(1), 20_000);
    return () => window.clearInterval(timer);
  }, [availableGroups.length, movePosition]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 45) return;
    movePosition(delta < 0 ? 1 : -1);
  };

  return (
    <section aria-label={title} className="relative isolate z-0 min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="grid grid-cols-4 gap-1.5 px-3 py-2.5 sm:gap-2 sm:px-5 sm:py-3" role="tablist" aria-label={isArabic ? "مراكز اللاعبين" : "Postes des joueurs"}>
        {POSITION_GROUPS.map((group) => {
          const Icon = group.icon;
          const active = position === group.key;
          const count = counts[group.key];
          return (
            <button
              key={group.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`${isArabic ? group.ar : group.fr} (${count})`}
              title={`${isArabic ? group.ar : group.fr} (${count})`}
              onClick={() => setPosition(group.key)}
              className={`inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2 text-[11px] font-bold transition-colors sm:gap-2 sm:px-3 sm:text-xs ${active ? "border-club-primary bg-club-primary text-white shadow-sm" : "border-border/70 bg-background/40 text-muted-foreground hover:border-club-primary/40 hover:bg-club-primary/5 hover:text-foreground"}`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${active ? "bg-white/15" : "bg-club-primary/10"}`}>
                <Icon className={`h-3.5 w-3.5 ${active ? "text-white" : "text-club-primary"}`} aria-hidden="true" />
              </span>
              <span className="hidden truncate sm:inline">{isArabic ? group.ar : group.fr}</span>
              <span className={`hidden font-mono sm:inline ${active ? "text-white/80" : "opacity-70"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-28 border-t border-border/60 p-4 sm:p-5" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ touchAction: "pan-y" }}>
        {shownPlayers.length ? (
          <ul className="grid grid-cols-2 items-stretch gap-2 sm:gap-3">
            {shownPlayers.map((player) => {
              const name = isArabic ? player.playerName : player.playerNameFr || player.playerName;
              return (
                <li key={player.playerId} className="min-w-0">
                  <Link
                    href={`/${locale}/team/${categorySlug}/players/${player.playerSlug}`}
                    className="inline-flex w-full max-w-full min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-background/40 p-2 transition-colors hover:border-club-primary/35 hover:bg-muted/40 sm:gap-3 sm:p-2.5"
                  >
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-bold text-foreground sm:h-10 sm:w-10">
                      {player.photoUrl ? (
                        <SafeImage src={player.photoUrl} fallbackSrc="/branding/person-placeholder.svg" alt={name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      ) : name.trim().charAt(0)}
                    </span>
                    <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-club-primary/20 bg-club-primary/10 px-1.5 font-mono text-xs font-black text-club-primary">
                      {player.shirtNumber ?? "–"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold leading-snug text-foreground sm:text-sm" title={name}>{name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-7 text-center text-sm text-muted-foreground">
            {isArabic ? `لا يوجد لاعبون ضمن ${selectedGroup.ar} في هذه التشكيلة.` : `Aucun joueur chez les ${selectedGroup.fr.toLowerCase()} dans cette composition.`}
          </p>
        )}
      </div>
    </section>
  );
}

export function MatchLineupCarousel({
  startingLineup,
  substitutes,
  locale,
  categorySlug
}: {
  startingLineup: PublicLineupItem[];
  substitutes: PublicLineupItem[];
  locale: string;
  categorySlug: string;
}) {
  const isArabic = locale === "ar";
  const [activeSquad, setActiveSquad] = useState<"STARTING" | "SUBSTITUTE">(
    startingLineup.length > 0 ? "STARTING" : "SUBSTITUTE"
  );
  const isStarting = activeSquad === "STARTING";
  return (
    <div className="relative isolate z-0 min-w-0 space-y-3">
      <div
        role="tablist"
        aria-label={isArabic ? "قائمة لاعبي المباراة" : "Effectif du match"}
        className="flex w-full gap-2 rounded-2xl border border-border/80 bg-card/70 p-1.5"
      >
        {(["STARTING", "SUBSTITUTE"] as const).map((squad) => {
          const active = activeSquad === squad;
          const Icon = squad === "STARTING" ? UsersRound : ShieldCheck;
          return (
            <button
              key={squad}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveSquad(squad)}
              className={`inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors sm:text-sm ${active ? "bg-club-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{squad === "STARTING"
                ? (isArabic ? "التشكيل الأساسي" : "Titulaires")
                : (isArabic ? "الاحتياط" : "Remplaçants")}</span>
              <span className="font-mono text-[10px] opacity-80">
                {squad === "STARTING" ? startingLineup.length : substitutes.length}
              </span>
            </button>
          );
        })}
      </div>

      <div
        key={activeSquad}
        role="tabpanel"
        aria-label={isStarting
          ? (isArabic ? "التشكيل الأساسي" : "Titulaires")
          : (isArabic ? "الاحتياط" : "Remplaçants")}
        className="animate-in fade-in slide-in-from-bottom-1 duration-200"
      >
        <PositionCarousel
          players={isStarting ? startingLineup : substitutes}
          title={isStarting
            ? (isArabic ? "التشكيل الأساسي" : "Titulaires")
            : (isArabic ? "الاحتياط" : "Remplaçants")}
          locale={locale}
          categorySlug={categorySlug}
        />
      </div>
    </div>
  );
}
