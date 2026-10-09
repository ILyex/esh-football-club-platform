"use client";

import { useMemo, useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import { frenchPublicText, localizedFootballPosition } from "@/lib/public/locale-text";

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
  onDragStartPlayer?: (playerId: string, event: DragEvent<HTMLDivElement>) => void;
  onClickPlayer?: (playerId: string) => void;
  selectedPlayerId?: string | null;
  compact?: boolean;
}

// Normalized coordinate [x (0-100), y (0-100)] where (0,0) is top-left,
// y=90 is GK (bottom), y=15 is Strikers (top), x=50 is center.
// Coordinate system is fixed strictly in LTR so left-back is on the left and right-back is on the right.
function positionGroup(position?: string | null): "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD" | null {
  const value = (position || "").toUpperCase().trim();
  if (["GOALKEEPER", "GK", "G", "حارس", "GARDIEN"].includes(value)) return "GOALKEEPER";
  if (["DEFENDER", "DF", "DEFENSEUR", "مدافع"].includes(value)) return "DEFENDER";
  if (["MIDFIELDER", "MF", "MILIEU", "وسط ميدان"].includes(value)) return "MIDFIELDER";
  if (["FORWARD", "FW", "ATTAQUANT", "مهاجم"].includes(value)) return "FORWARD";
  return null;
}

function getPlayerCoordinates(index: number, total: number, position?: string | null, groupIndex = index, groupTotal = total): { x: number; y: number } {
  const pos = (position || "").toUpperCase().trim();

  const group = positionGroup(position);
  if (group) {
    const y = group === "FORWARD" ? 18 : group === "MIDFIELDER" ? 44 : group === "DEFENDER" ? 68 : 88;
    const x = group === "GOALKEEPER" || groupTotal <= 1 ? 50 : 14 + (groupIndex / (groupTotal - 1)) * 72;
    return { x, y };
  }

  // Known football position coordinate overrides
  if (pos === "GK" || pos === "G" || pos === "حارس" || pos === "GARDIEN") return { x: 50, y: 88 };
  if (pos === "LB" || pos === "ظهير أيسر") return { x: 18, y: 70 };
  if (pos === "CB" || pos === "قلب دفاع" || pos === "DC") {
    // Distribute multiple CBs
    return { x: index % 2 === 0 ? 38 : 62, y: 72 };
  }
  if (pos === "RB" || pos === "ظهير أيمن") return { x: 82, y: 70 };
  if (pos === "DM" || pos === "MDF" || pos === "ارتكاز") return { x: 50, y: 56 };
  if (pos === "CM" || pos === "MC" || pos === "وسط") {
    return { x: index % 2 === 0 ? 32 : 68, y: 48 };
  }
  if (pos === "LM" || pos === "ML") return { x: 18, y: 46 };
  if (pos === "RM" || pos === "MR") return { x: 82, y: 46 };
  if (pos === "CAM" || pos === "MO" || pos === "صانع ألعاب") return { x: 50, y: 36 };
  if (pos === "LW" || pos === "AL" || pos === "جناح أيسر") return { x: 20, y: 22 };
  if (pos === "RW" || pos === "AR" || pos === "جناح أيمن") return { x: 80, y: 22 };
  if (pos === "ST" || pos === "CF" || pos === "AC" || pos === "مهاجم") return { x: 50, y: 16 };

  // Fallback: standard 4-3-3 tactical distribution based on lineup index (0 = GK, 1-4 = DEF, 5-7 = MID, 8-10 = FWD)
  if (index === 0) return { x: 50, y: 88 }; // GK
  if (index === 1) return { x: 18, y: 70 }; // LB
  if (index === 2) return { x: 38, y: 72 }; // CB1
  if (index === 3) return { x: 62, y: 72 }; // CB2
  if (index === 4) return { x: 82, y: 70 }; // RB
  if (index === 5) return { x: 32, y: 48 }; // LCM
  if (index === 6) return { x: 50, y: 54 }; // DM
  if (index === 7) return { x: 68, y: 48 }; // RCM
  if (index === 8) return { x: 20, y: 22 }; // LW
  if (index === 9) return { x: 50, y: 16 }; // ST
  if (index === 10) return { x: 80, y: 22 }; // RW

  // Generic fallback if more than 11 players
  return {
    x: 20 + ((index * 17) % 65),
    y: 30 + ((index * 13) % 50)
  };
}

export function TacticalPitch({
  startingLineup,
  isClubTeam = true,
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
  // CRITICAL (Spec A.5 & A.9.2): Tactical pitch coordinate system MUST be explicitly dir="ltr"
  // so spatial left-wing/right-wing remain mathematically stable regardless of page RTL/LTR state.
  const playersWithCoords = useMemo(() => {
    return startingLineup.slice(0, 11).map((player, idx) => {
      const group = positionGroup(player.position);
      const sameGroup = group ? startingLineup.filter((candidate) => positionGroup(candidate.position) === group) : [];
      const groupIndex = sameGroup.findIndex((candidate) => candidate.playerId === player.playerId);
      const coords = getPlayerCoordinates(idx, startingLineup.length, player.position, groupIndex, sameGroup.length);
      return { ...player, ...coords };
    });
  }, [startingLineup]);

  return (
    <div
      dir="ltr"
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-emerald-700/70 bg-[linear-gradient(180deg,#07513f_0%,#063b34_52%,#052e2b_100%)] text-white shadow-xl shadow-emerald-950/25 select-none",
        className,
        editable && "transition-shadow",
        dropActive && "ring-4 ring-club-primary/60 ring-offset-2 ring-offset-background"
      )}
      style={compact ? { aspectRatio: "4 / 5", minHeight: "350px" } : { aspectRatio: "3 / 4", minHeight: "440px" }}
      aria-label={locale === "ar" ? "الرسم التكتيكي للمباراة" : "Tactical match formation"}
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
      {/* Pitch Grass Texture & Subtle Grid */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#d1fae5_1px,transparent_1px)] [background-size:18px_18px]" />

      {/* SVG Football Field Markings */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none stroke-white/40"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 133.33"
        preserveAspectRatio="none"
        fill="none"
        strokeWidth="0.65"
      >
        {/* Outer Boundary */}
        <rect x="5" y="5" width="90" height="123.33" rx="1.5" />

        {/* Halfway Line */}
        <line x1="5" y1="66.66" x2="95" y2="66.66" />

        {/* Center Circle & Spot */}
        <circle cx="50" cy="66.66" r="12" />
        <circle cx="50" cy="66.66" r="0.8" fill="currentColor" />

        {/* Top Penalty Area (Opponent Box) */}
        <rect x="22" y="5" width="56" height="20" />
        <rect x="36" y="5" width="28" height="7" />
        <circle cx="50" cy="18" r="0.8" fill="currentColor" />
        <path d="M 39 25 A 11 11 0 0 0 61 25" />

        {/* Bottom Penalty Area (Defending / Home Box) */}
        <rect x="22" y="108.33" width="56" height="20" />
        <rect x="36" y="121.33" width="28" height="7" />
        <circle cx="50" cy="115.33" r="0.8" fill="currentColor" />
        <path d="M 39 108.33 A 11 11 0 0 1 61 108.33" />
      </svg>

      {/* Pitch Goal Labels */}
      <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-bold uppercase tracking-widest text-white/30 pointer-events-none">
        {locale === "ar" ? "المرمى" : "But"}
      </div>

      {/* Interactive Player Nodes */}
      <div className="absolute inset-0 z-20">
        {playersWithCoords.map((p) => {
          const displayName = locale === "fr"
            ? frenchPublicText(p.playerNameFr || p.playerName, p.shirtNumber == null ? "Joueur" : `Joueur n°${p.shirtNumber}`)
            : p.playerName;
          const positionLabel = localizedFootballPosition(p.position, locale);
          return <div
            key={p.playerId}
            draggable={editable}
            onDragStart={editable ? (event) => onDragStartPlayer?.(p.playerId, event) : undefined}
            onClick={editable ? (event) => { event.stopPropagation(); onClickPlayer?.(p.playerId); } : undefined}
            onKeyDown={editable ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClickPlayer?.(p.playerId);
              }
            } : undefined}
            role={editable ? "button" : undefined}
            tabIndex={editable ? 0 : undefined}
            aria-label={`${displayName}${positionLabel ? ` — ${positionLabel}` : ""}${p.shirtNumber == null ? "" : ` — ${locale === "ar" ? "رقم" : "N°"} ${p.shirtNumber}`}`}
            title={`${displayName}${positionLabel ? ` — ${positionLabel}` : ""}`}
            className={cn("absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 group", editable ? "cursor-grab active:cursor-grabbing" : "cursor-default")}
            style={{ left: `${p.x}%`, top: `${p.y * 0.82 + 8}%` }}
          >
            {/* Compact player marker: portrait and shirt number only. */}
            <div className={cn(
              "relative h-9 w-9 shrink-0 overflow-visible rounded-full sm:h-10 sm:w-10",
              selectedPlayerId === p.playerId && "scale-110"
            )}>
              <div className={cn(
                "absolute inset-0 overflow-hidden rounded-full border-2 bg-zinc-900 shadow-md transition-all",
                isClubTeam ? "border-white ring-2 ring-emerald-300/70 group-hover:ring-emerald-100" : "border-zinc-200",
                selectedPlayerId === p.playerId && "ring-4 ring-amber-300"
              )}>
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt={displayName} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-800 to-zinc-900 text-sm font-bold text-emerald-100">
                    {displayName.trim().charAt(0) || "?"}
                  </div>
                )}
              </div>
              <span className="absolute -bottom-1 -end-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-emerald-950 bg-club-primary px-0.5 font-mono text-[8px] font-black leading-none text-white shadow-md sm:h-[18px] sm:min-w-[18px] sm:text-[9px]">
                {p.shirtNumber ?? "–"}
              </span>
            </div>
            <span
              dir={locale === "ar" ? "rtl" : "ltr"}
              className="absolute left-1/2 top-full mt-1 w-[84px] max-w-[84px] -translate-x-1/2 line-clamp-2 min-h-5 whitespace-normal break-words rounded-lg border border-emerald-100/20 bg-gradient-to-b from-zinc-950/95 to-emerald-950/95 px-1.5 py-0.5 text-center text-[9px] font-bold leading-3 text-white shadow-[0_3px_8px_rgba(0,0,0,0.32)] ring-1 ring-black/20 backdrop-blur-sm sm:text-[10px]"
            >
              {displayName}
            </span>
          </div>;
        })}
      </div>
    </div>
  );
}
