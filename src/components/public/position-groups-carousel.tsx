"use client";

import { useEffect, useRef, useState } from "react";
import { CircleDot, Goal, ShieldCheck, Target, UserRound, UsersRound } from "lucide-react";
import { PlayerCard } from "@/components/public/player-card";
import type { PublicPlayerItem, PublicStaffItem } from "@/lib/public/teams";
import { SafeImage } from "@/components/shared/safe-image";

type PositionGroup = {
  key: string;
  title: string;
  players: PublicPlayerItem[];
  positionLabel: string;
};
type StaffGroup = { key: "staff"; title: string; players: []; positionLabel: string; staff: PublicStaffItem[] };

const positionIcons = [Goal, ShieldCheck, CircleDot, Target];
const isStaffGroup = (group: PositionGroup | StaffGroup): group is StaffGroup => "staff" in group;

export function PositionGroupsCarousel({
  groups,
  locale,
  categorySlug,
  labels,
  emptyLabel,
  playerLabel,
  staff,
  staffTitle,
  staffRoleLabels
}: {
  groups: PositionGroup[];
  locale: string;
  categorySlug: string;
  labels: { age: string; yearsOld: string; viewProfile: string };
  emptyLabel: string;
  playerLabel: string;
  staff: PublicStaffItem[];
  staffTitle: string;
  staffRoleLabels: Record<string, string>;
}) {
  const carouselGroups: Array<PositionGroup | StaffGroup> = [
    { key: "staff", title: staffTitle, players: [], positionLabel: "", staff },
    ...groups
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const activeGroup = carouselGroups[activeIndex] ?? carouselGroups[0];

  const moveTo = (direction: 1 | -1) => {
    setActiveIndex((current) => (current + direction + carouselGroups.length) % carouselGroups.length);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStartX.current == null) return;
    const endX = event.changedTouches[0]?.clientX;
    const distance = endX == null ? 0 : endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 45 || carouselGroups.length < 2) return;
    // In RTL, a left swipe advances to the next position.
    moveTo(distance < 0 ? 1 : -1);
  };

  useEffect(() => {
    if (carouselGroups.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % carouselGroups.length);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [carouselGroups.length]);

  if (!activeGroup) return null;

  return (
    <section
      className="mt-5 rounded-2xl border border-border bg-card p-2.5 shadow-xs sm:mt-8 sm:p-5"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "pan-y" }}
    >
      <div className="mb-3 flex flex-col gap-2 border-b border-border/70 pb-3 sm:mb-5 sm:gap-3 sm:pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {(() => {
            const Icon = positionIcons[activeIndex % positionIcons.length] ?? CircleDot;
            return isStaffGroup(activeGroup)
              ? <UsersRound className="h-5 w-5 shrink-0 text-club-primary" aria-hidden="true" />
              : <Icon className="h-5 w-5 shrink-0 text-club-primary" aria-hidden="true" />;
          })()}
          <h2 className="truncate text-sm font-bold text-foreground sm:text-lg">{activeGroup.title}</h2>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
            {isStaffGroup(activeGroup) ? `${activeGroup.staff.length} ${locale === "ar" ? "عضو" : "membres"}` : `${activeGroup.players.length} ${playerLabel}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={locale === "ar" ? "مراكز اللاعبين" : "Postes des joueurs"}>
          {carouselGroups.map((group, index) => {
            const Icon = positionIcons[index % positionIcons.length] ?? CircleDot;
            const isActive = index === activeIndex;
            return (
              <button
                key={group.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={group.title}
                title={group.title}
                onClick={() => setActiveIndex(index)}
                className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition-colors sm:h-9 sm:gap-1.5 sm:px-2.5 sm:text-xs ${
                  isActive
                    ? "border-club-primary bg-club-primary text-white"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-club-primary/50 hover:text-club-primary"
                }`}
              >
                {isStaffGroup(group) ? <UsersRound className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
                <span className="hidden sm:inline">{group.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isStaffGroup(activeGroup) ? (
        activeGroup.staff.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {activeGroup.staff.map((member) => (
              <div key={member.id} className="group flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background/40 p-2 transition-all hover:-translate-y-0.5 hover:border-club-primary/40 hover:shadow-md sm:gap-3 sm:rounded-2xl sm:p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted/70 text-muted-foreground sm:h-12 sm:w-12">
                  {member.photoUrl ? <SafeImage src={member.photoUrl} fallbackSrc="/branding/person-placeholder.svg" alt={`${member.firstName} ${member.lastName}`} className="h-full w-full object-cover" /> : <UserRound className="h-4 w-4 sm:h-6 sm:w-6" />}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-[11px] font-bold text-foreground group-hover:text-club-primary sm:text-sm">{member.firstName} {member.lastName}</h3>
                  <p className="truncate text-[10px] font-semibold text-club-primary sm:text-xs">{staffRoleLabels[member.role] || member.role}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-8 text-center text-xs italic text-muted-foreground">{emptyLabel}</p>
        )
      ) : activeGroup.players.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {activeGroup.players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              locale={locale}
              categorySlug={categorySlug}
              positionLabel={activeGroup.positionLabel}
              labels={labels}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-8 text-center text-xs italic text-muted-foreground">
          {emptyLabel}
        </p>
      )}

      <div className="mt-3 flex items-center justify-center gap-1 sm:mt-5 sm:gap-1.5" aria-label={locale === "ar" ? "صفحات المراكز" : "Pages des postes"}>
        {carouselGroups.map((group, index) => (
          <button
            key={`${group.key}-dot`}
            type="button"
            aria-label={`${group.title} ${locale === "ar" ? "صفحة" : "page"}`}
            aria-current={index === activeIndex ? "page" : undefined}
            onClick={() => setActiveIndex(index)}
            className="flex h-6 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40 sm:h-10 sm:w-10"
          >
            <span className={`block h-2.5 rounded-full transition-all ${
              index === activeIndex
                ? "w-5 bg-club-primary sm:w-7"
                : "w-1.5 bg-club-primary/35 hover:bg-club-primary/65 sm:w-2.5"
            }`} />
          </button>
        ))}
      </div>
    </section>
  );
}
