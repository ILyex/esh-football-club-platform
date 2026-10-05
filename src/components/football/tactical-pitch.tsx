"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface PitchPlayer {
  playerId: string;
  playerName: string;
  shirtNumber?: number | null;
  position?: string | null;
  isCaptain?: boolean;
}

interface TacticalPitchProps {
  startingLineup: PitchPlayer[];
  teamName: string;
  formation?: string; // e.g. "4-3-3", "4-4-2", "4-2-3-1"
  isClubTeam?: boolean;
  className?: string;
  locale?: string;
}

// Normalized coordinate [x (0-100), y (0-100)] where (0,0) is top-left,
// y=90 is GK (bottom), y=15 is Strikers (top), x=50 is center.
// Coordinate system is fixed strictly in LTR so left-back is on the left and right-back is on the right.
function getPlayerCoordinates(index: number, total: number, position?: string | null): { x: number; y: number } {
  const pos = (position || "").toUpperCase().trim();

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
  teamName,
  formation = "4-3-3",
  isClubTeam = true,
  className,
  locale = "ar"
}: TacticalPitchProps) {
  // CRITICAL (Spec A.5 & A.9.2): Tactical pitch coordinate system MUST be explicitly dir="ltr"
  // so spatial left-wing/right-wing remain mathematically stable regardless of page RTL/LTR state.
  const playersWithCoords = useMemo(() => {
    return startingLineup.slice(0, 11).map((player, idx) => {
      const coords = getPlayerCoordinates(idx, startingLineup.length, player.position);
      return { ...player, ...coords };
    });
  }, [startingLineup]);

  return (
    <div
      dir="ltr"
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-emerald-900/60 bg-gradient-to-b from-emerald-950 to-emerald-900 text-white shadow-md select-none",
        className
      )}
      style={{ aspectRatio: "3 / 4", minHeight: "440px" }}
      aria-label={`Tactical pitch: ${teamName} (${formation})`}
    >
      {/* Pitch Grass Texture & Subtle Grid */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

      {/* SVG Football Field Markings */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none stroke-white/40"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 133.33"
        preserveAspectRatio="none"
        fill="none"
        strokeWidth="0.75"
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

      {/* Pitch Header Badge (Team & Formation) */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between text-[11px] font-semibold tracking-wider text-emerald-200/90 z-10 pointer-events-none">
        <span className="truncate drop-shadow-sm font-bold">{teamName}</span>
        <span className="rounded bg-black/40 px-2 py-0.5 backdrop-blur-xs font-mono text-[10px] text-white">
          {formation}
        </span>
      </div>

      {/* Pitch Goal Labels */}
      <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-bold uppercase tracking-widest text-white/30 pointer-events-none">
        {locale === "ar" ? "المرمى" : "But"}
      </div>

      {/* Interactive Player Nodes */}
      <div className="absolute inset-0 z-20">
        {playersWithCoords.map((p) => (
          <div
            key={p.playerId}
            className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 cursor-pointer group"
            style={{ left: `${p.x}%`, top: `${p.y * 0.82 + 8}%` }}
          >
            {/* Player Shirt Token */}
            <div
              className={cn(
                "relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full font-mono text-xs sm:text-sm font-extrabold shadow-lg transition-all",
                isClubTeam
                  ? "bg-club-primary text-white border-2 border-white ring-2 ring-club-primary/40 group-hover:ring-white"
                  : "bg-zinc-800 text-zinc-100 border-2 border-zinc-400 group-hover:border-white"
              )}
            >
              <span>{p.shirtNumber ?? "-"}</span>
              {p.isCaptain && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 font-mono text-[9px] font-black text-black ring-1 ring-white">
                  C
                </span>
              )}
            </div>

            {/* Name & Position Tag */}
            <div className="mt-1 flex flex-col items-center max-w-[80px] sm:max-w-[100px] text-center">
              <span className="truncate w-full rounded-xs bg-black/60 px-1 py-0.5 font-medium text-[10px] sm:text-[11px] text-white backdrop-blur-xs drop-shadow-sm group-hover:bg-black/80">
                {p.playerName}
              </span>
              {p.position && (
                <span className="text-[9px] font-semibold text-emerald-300/80 uppercase">
                  {p.position}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
