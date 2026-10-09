"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Shield, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useSwipeCarousel } from "@/hooks/use-swipe-carousel";
import { localizedFootballPosition } from "@/lib/public/locale-text";
import { SafeImage } from "@/components/shared/safe-image";

const PAGE_SIZE = 8;

export interface MatchLineupRosterPlayer {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  shirtNumber: number | null;
  selectionStatus: string;
  isStarting: boolean;
  position: string | null;
}

export function MatchLineupRosterCarousel({
  players,
  locale,
  canRemove,
  statusLabels,
  startingLabel,
  substituteLabel,
  emptyLabel,
  removeLabel,
  removePlayer
}: {
  players: MatchLineupRosterPlayer[];
  locale: string;
  canRemove: boolean;
  statusLabels: Record<string, string>;
  startingLabel: string;
  substituteLabel: string;
  emptyLabel: string;
  removeLabel: string;
  removePlayer: (playerId: string) => Promise<void>;
}) {
  const isAr = locale === "ar";
  const pageCount = Math.max(1, Math.ceil(players.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const previousPlayerIds = useRef(new Set(players.map((player) => player.id)));

  useEffect(() => {
    const currentIds = new Set(players.map((player) => player.id));
    const newlyAddedIndex = players.findIndex((player) => !previousPlayerIds.current.has(player.id));
    if (newlyAddedIndex >= 0) setPage(Math.floor(newlyAddedIndex / PAGE_SIZE));
    else setPage((current) => Math.min(current, pageCount - 1));
    previousPlayerIds.current = currentIds;
  }, [players, pageCount]);

  const goTo = (nextPage: number) => setPage(Math.max(0, Math.min(pageCount - 1, nextPage)));
  const swipe = useSwipeCarousel(() => goTo(page + 1), () => goTo(page - 1));
  const visiblePlayers = players.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const PreviousIcon = isAr ? ChevronRight : ChevronLeft;
  const NextIcon = isAr ? ChevronLeft : ChevronRight;

  if (players.length === 0) {
    return <p className="mb-5 rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <section className="mb-5 rounded-2xl border border-border/70 bg-background/30 p-4 sm:p-5" aria-label={isAr ? "لاعبو المباراة" : "Joueurs du match"}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">
          {isAr ? `اللاعبون ${players.length}` : `${players.length} joueurs`}
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <span className="min-w-10 text-center font-mono text-[11px] text-muted-foreground" dir="ltr">{page + 1} / {pageCount}</span>
            <button type="button" onClick={() => goTo(page - 1)} disabled={page === 0} aria-label={isAr ? "الصفحة السابقة" : "Page précédente"} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-club-primary/40 hover:text-club-primary disabled:opacity-40">
              <PreviousIcon className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => goTo(page + 1)} disabled={page === pageCount - 1} aria-label={isAr ? "الصفحة التالية" : "Page suivante"} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-club-primary/40 hover:text-club-primary disabled:opacity-40">
              <NextIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div {...swipe} className="grid min-h-36 grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-8" aria-live="polite">
        {visiblePlayers.map((player) => {
          const fullName = `${player.firstName} ${player.lastName}`.trim();
          const statusLabel = statusLabels[player.selectionStatus] || (player.isStarting ? startingLabel : substituteLabel);
          return (
            <article key={player.id} className="flex min-w-0 flex-col items-center text-center">
              <div className="relative mb-2">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-club-primary/25 bg-muted/60 text-muted-foreground shadow-sm sm:h-[72px] sm:w-[72px]">
                  {player.photoUrl ? (
                    <SafeImage src={player.photoUrl} fallbackSrc="/branding/person-placeholder.svg" alt={fullName} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-club-primary/5 text-sm font-bold text-club-primary" aria-label={fullName}>
                      {player.firstName.slice(0, 1)}{player.lastName.slice(0, 1)}
                    </span>
                  )}
                </div>
                <span className="absolute -bottom-1 -end-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-card bg-club-primary px-1 text-[10px] font-black text-white" aria-label={player.shirtNumber == null ? undefined : `${isAr ? "رقم" : "N°"} ${player.shirtNumber}`}>
                  {player.shirtNumber ?? <Shield className="h-3 w-3" aria-hidden="true" />}
                </span>
                {canRemove && (
                  <ConfirmDialog onConfirm={() => removePlayer(player.id)} title={isAr ? "حذف اللاعب من المباراة؟" : "Retirer ce joueur du match ?"}>
                    <button type="button" aria-label={`${removeLabel}: ${fullName}`} title={removeLabel} className="absolute -top-1 -start-1 flex h-6 w-6 items-center justify-center rounded-full border border-destructive/30 bg-card text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-white">
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </ConfirmDialog>
                )}
              </div>
              <p className="w-full truncate text-xs font-bold text-foreground" title={fullName}>{fullName}</p>
              <Badge tone={player.selectionStatus === "STARTING" || player.isStarting ? "success" : "neutral"} className="mt-1 max-w-full truncate px-2 py-0.5 text-[10px]">
                {statusLabel}
              </Badge>
              {player.position && <span className="mt-1 max-w-full truncate text-[10px] text-muted-foreground" title={localizedFootballPosition(player.position, locale)}>{localizedFootballPosition(player.position, locale)}</span>}
            </article>
          );
        })}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-center gap-1.5" aria-label={isAr ? "صفحات اللاعبين" : "Pages des joueurs"}>
          {Array.from({ length: pageCount }, (_, index) => (
            <button key={index} type="button" onClick={() => goTo(index)} aria-label={isAr ? `صفحة اللاعبين ${index + 1}` : `Page des joueurs ${index + 1}`} aria-current={page === index ? "page" : undefined} className={`h-2.5 rounded-full transition-all ${page === index ? "w-7 bg-club-primary" : "w-2.5 bg-club-primary/30 hover:bg-club-primary/60"}`} />
          ))}
        </div>
      )}
    </section>
  );
}
