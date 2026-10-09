"use client";

import { useMemo, useState, type DragEvent } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { frenchPublicText } from "@/lib/public/locale-text";

export interface PitchPlayer {
  playerId: string;
  playerName: string;
  playerNameFr?: string | null;
  photoUrl?: string | null;
  shirtNumber?: number | null;
  position?: string | null;
  isCaptain?: boolean;
}

interface TacticalPitchProps {
  startingLineup: PitchPlayer[];
  isClubTeam?: boolean;
  className?: string;
  locale?: string;
  editable?: boolean;
  onDropPlayer?: (playerId: string) => void;
  onClickField?: () => void;
  onDragStartPlayer?: (playerId: string, event: DragEvent<HTMLButtonElement>) => void;
  onClickPlayer?: (playerId: string) => void;
  selectedPlayerId?: string | null;
  compact?: boolean;
}

type PositionGroup = "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD";

const POSITION_GROUPS: PositionGroup[] = ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"];
const DEFAULT_SLOT_COUNT: Record<PositionGroup, number> = { GOALKEEPER: 1, DEFENDER: 4, MIDFIELDER: 3, FORWARD: 3 };
const GROUP_Y: Record<PositionGroup, number> = { GOALKEEPER: 16, DEFENDER: 37, MIDFIELDER: 62, FORWARD: 84 };

function positionGroup(position?: string | null): PositionGroup | null {
  const value = (position || "").toUpperCase().trim();
  if (["GOALKEEPER", "GK", "G"].includes(value) || value.includes("حارس") || value.includes("GARDIEN")) return "GOALKEEPER";
  if (["DEFENDER", "DF", "DEFENSEUR"].includes(value) || value.includes("مدافع") || value.includes("دفاع")) return "DEFENDER";
  if (["MIDFIELDER", "MF", "MILIEU"].includes(value) || value.includes("وسط") || value.includes("MILIEU")) return "MIDFIELDER";
  if (["FORWARD", "FW", "ATTAQUANT"].includes(value) || value.includes("مهاجم") || value.includes("ATTAQU")) return "FORWARD";
  if (["LB", "CB", "RB", "DC", "DL", "DR"].includes(value)) return "DEFENDER";
  if (["DM", "CM", "LM", "RM", "CAM", "AM", "MDF", "MC", "MO"].includes(value)) return "MIDFIELDER";
  if (["LW", "RW", "ST", "CF"].includes(value)) return "FORWARD";
  return null;
}

function fallbackGroup(index: number): PositionGroup {
  if (index === 0) return "GOALKEEPER";
  if (index <= 4) return "DEFENDER";
  if (index <= 7) return "MIDFIELDER";
  return "FORWARD";
}

function slotXPositions(count: number, group: PositionGroup): number[] {
  if (count <= 1) return [50];
  const groupSpread: Record<PositionGroup, number> = { GOALKEEPER: 34, DEFENDER: 60, MIDFIELDER: 52, FORWARD: 52 };
  const spread = count <= 4 ? groupSpread[group] : Math.min(70, groupSpread[group] + (count - 4) * 4);
  return Array.from({ length: count }, (_, index) => 50 - spread / 2 + (spread * index) / (count - 1));
}

function roleLabel(group: PositionGroup, locale: string) {
  if (locale === "fr") return { GOALKEEPER: "GARDIEN", DEFENDER: "DÉFENSE", MIDFIELDER: "MILIEU", FORWARD: "ATTAQUE" }[group];
  return { GOALKEEPER: "حارس", DEFENDER: "دفاع", MIDFIELDER: "وسط", FORWARD: "هجوم" }[group];
}

function roleShortLabel(group: PositionGroup, locale: string) {
  if (locale === "fr") return { GOALKEEPER: "GK", DEFENDER: "DEF", MIDFIELDER: "MID", FORWARD: "FWD" }[group];
  return { GOALKEEPER: "حارس", DEFENDER: "دفاع", MIDFIELDER: "وسط", FORWARD: "هجوم" }[group];
}

export function TacticalPitch({
  startingLineup,
  className,
  locale = "ar",
  editable = false,
  onDropPlayer,
  onClickField,
  onDragStartPlayer,
  onClickPlayer,
  selectedPlayerId,
  compact = false
}: TacticalPitchProps) {
  const [dropActive, setDropActive] = useState(false);
  const groups = useMemo(() => {
    const grouped: Record<PositionGroup, PitchPlayer[]> = { GOALKEEPER: [], DEFENDER: [], MIDFIELDER: [], FORWARD: [] };
    startingLineup.slice(0, 11).forEach((player, index) => grouped[positionGroup(player.position) ?? fallbackGroup(index)].push(player));
    const overflow: PitchPlayer[] = [];
    for (const group of POSITION_GROUPS) {
      if (grouped[group].length > DEFAULT_SLOT_COUNT[group]) {
        overflow.push(...grouped[group].splice(DEFAULT_SLOT_COUNT[group]));
      }
    }
    // Rebalance extra players into open outfield slots so the visual always remains a full 4-3-3.
    for (const group of ["DEFENDER", "MIDFIELDER", "FORWARD"] as const) {
      const freeSlots = DEFAULT_SLOT_COUNT[group] - grouped[group].length;
      if (freeSlots > 0) grouped[group].push(...overflow.splice(0, freeSlots));
    }
    return grouped;
  }, [startingLineup]);
  const slots = useMemo(() => POSITION_GROUPS.flatMap((group) => {
    const groupPlayers = groups[group];
    // UX FIX: A 4-3-3 always has exactly eleven field positions.
    const slotCount = editable ? DEFAULT_SLOT_COUNT[group] : Math.min(DEFAULT_SLOT_COUNT[group], groupPlayers.length);
    return Array.from({ length: slotCount }, (_, index) => ({
      group,
      player: groupPlayers[index] ?? null,
      x: slotXPositions(slotCount, group)[index] ?? 50,
      y: GROUP_Y[group]
    }));
  }), [editable, groups]);
  const formation = "4–3–3";

  return (
    <div
      dir="ltr"
      className={cn("relative isolate w-full overflow-hidden rounded-[1.6rem] border border-club-primary/35 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-2.5 text-white shadow-xl shadow-black/25 select-none sm:p-3", className, dropActive && "ring-4 ring-club-primary/60 ring-offset-2 ring-offset-background")}
      style={{ aspectRatio: compact ? "1.55 / 1" : "1.72 / 1", minHeight: compact ? "330px" : "370px" }}
      aria-label={locale === "ar" ? "خطة المباراة" : "Plan de jeu"}
      onDragOver={editable ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropActive(true); } : undefined}
      onDragLeave={editable ? (event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropActive(false); } : undefined}
      onDrop={editable ? (event) => {
        event.preventDefault();
        setDropActive(false);
        const playerId = event.dataTransfer.getData("text/plain");
        if (playerId) onDropPlayer?.(playerId);
      } : undefined}
      onClick={editable ? onClickField : undefined}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(225,29,46,0.12),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.035),transparent_46%)]" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="lineup-pitch-surface" x1="50" y1="3" x2="50" y2="98" gradientUnits="userSpaceOnUse"><stop stopColor="#111315" /><stop offset="1" stopColor="#202326" /></linearGradient>
          <pattern id="lineup-pitch-grain" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.16" fill="#ffffff" fillOpacity="0.07" /></pattern>
        </defs>
        <path d="M23 5H77L98 97H2L23 5Z" fill="url(#lineup-pitch-surface)" stroke="#f4f4f5" strokeOpacity="0.55" strokeWidth="0.58" />
        <path d="M23 5H77L98 97H2L23 5Z" fill="url(#lineup-pitch-grain)" />
        <path d="M12 51H88" stroke="#f4f4f5" strokeOpacity="0.38" strokeWidth="0.38" />
        <ellipse cx="50" cy="51" rx="12.5" ry="9" stroke="#f4f4f5" strokeOpacity="0.42" strokeWidth="0.38" />
        <circle cx="50" cy="51" r="0.58" fill="#e11d2e" />
        <path d="M36 5L33.5 20H66.5L64 5M43 5L42 10H58L57 5M31 20L29.5 29H70.5L69 20M38 29C38 35 43 39 50 39C57 39 62 35 62 29" stroke="#f4f4f5" strokeOpacity="0.48" strokeWidth="0.36" />
        <path d="M31 80L29.5 71H70.5L69 80M36 97L33.5 80H66.5L64 97M38 71C38 65 43 61 50 61C57 61 62 65 62 71" stroke="#f4f4f5" strokeOpacity="0.48" strokeWidth="0.36" />
      </svg>

      <div className="pointer-events-none absolute inset-x-3 top-2 z-10 flex items-center justify-between sm:inset-x-5 sm:top-3">
        <span className="rounded-lg border border-white/10 bg-zinc-950/75 px-2 py-1 text-[8px] font-bold tracking-[0.12em] text-white/65 shadow-lg backdrop-blur-sm sm:text-[9px]">
          {locale === "fr" ? "PLAN DU MATCH" : "خطة المباراة"}
        </span>
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800/95 px-2.5 py-1.5 text-[9px] font-bold text-white shadow-lg sm:px-3 sm:text-[10px]">
          <span className="text-white/55">{locale === "fr" ? "FORMATION" : "الخطة"}</span>
          <span className="font-mono tracking-[0.1em]">{formation}</span>
        </span>
      </div>

      <div className="absolute inset-0 z-20">
        {slots.map(({ group, player, x, y }, index) => {
          if (!player && !editable) return null;
          const displayName = player
            ? locale === "fr"
              ? frenchPublicText(player.playerNameFr || player.playerName, player.shirtNumber == null ? "Joueur" : `Joueur n°${player.shirtNumber}`)
              : player.playerName
            : null;
          const positionLabel = roleLabel(group, locale);
          const ariaLabel = player
            ? `${displayName}${positionLabel ? ` — ${positionLabel}` : ""}${player.shirtNumber == null ? "" : ` — ${locale === "ar" ? "رقم" : "N°"} ${player.shirtNumber}`}`
            : (locale === "ar" ? `إضافة لاعب — ${positionLabel}` : `Ajouter un joueur — ${positionLabel}`);
          const contents = <>
            <span className="relative flex h-12 w-full items-center justify-center sm:h-[3.7rem]">
              {player ? <span className="absolute bottom-0 z-10 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-club-primary to-zinc-800 text-[11px] font-black text-white shadow-lg ring-2 ring-black/50 sm:h-11 sm:w-11">
                {player.photoUrl ? <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={player.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover object-center" />
                </> : displayName?.trim().charAt(0) || "?"}
              </span> : <span className="absolute bottom-1 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-zinc-900 bg-white text-zinc-950 shadow-lg transition-transform group-hover/slot:scale-110 sm:h-10 sm:w-10"><Plus className="h-4 w-4" strokeWidth={2.8} aria-hidden="true" /></span>}
              {player?.shirtNumber != null && <span className="absolute bottom-0 end-[5%] z-20 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-club-primary px-1 font-mono text-[8px] font-black text-white shadow">{player.shirtNumber}</span>}
              {player?.isCaptain && <span className="absolute start-[7%] top-0 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-zinc-950">C</span>}
            </span>
            <span className={cn("-mt-0.5 flex min-h-7 w-full flex-col items-center justify-center rounded-md border px-1 py-0.5 text-center shadow-lg", player ? "border-white/10 bg-zinc-800" : "border-white/15 bg-zinc-800/95", selectedPlayerId === player?.playerId && "ring-2 ring-amber-300")}>
              <span className="max-w-full truncate text-[7px] font-black uppercase leading-3 tracking-wide text-white sm:text-[8px]">{roleShortLabel(group, locale)}</span>
              {player && <span className="w-full truncate text-[7px] font-medium leading-3 text-white/65 sm:text-[8px]" title={displayName ?? undefined}>{displayName}</span>}
            </span>
          </>;

          const nodeClass = cn("group/slot absolute flex w-[14.5%] min-w-[60px] max-w-[100px] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-lg p-0.5 transition-transform", player && editable ? "cursor-grab active:cursor-grabbing hover:scale-105" : !player && editable ? "cursor-pointer hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/70" : "cursor-default", selectedPlayerId === player?.playerId && "z-30 scale-105");
          const style = { left: `${x}%`, top: `${y}%` };

          return player ? <button
            key={player.playerId}
            type="button"
            draggable={editable}
            onDragStart={editable ? (event) => onDragStartPlayer?.(player.playerId, event) : undefined}
            onClick={editable ? (event) => { event.stopPropagation(); onClickPlayer?.(player.playerId); } : undefined}
            className={nodeClass}
            style={style}
            aria-label={ariaLabel}
            title={ariaLabel}
          >{contents}</button> : <button
            key={`${group}-empty-${index}`}
            type="button"
            onClick={(event) => { event.stopPropagation(); onClickField?.(); }}
            className={nodeClass}
            style={style}
            aria-label={ariaLabel}
            title={ariaLabel}
          >{contents}</button>;
        })}
      </div>
      {dropActive && <div className="pointer-events-none absolute inset-x-4 bottom-3 z-30 rounded-lg border border-white/25 bg-black/75 px-3 py-2 text-center text-[11px] font-bold text-white shadow-lg backdrop-blur-sm">{locale === "ar" ? "أفلت اللاعب لإضافته إلى الخطة" : "Déposez le joueur pour l’ajouter au plan"}</div>}
    </div>
  );
}
