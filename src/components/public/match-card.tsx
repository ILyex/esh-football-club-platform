import Link from "next/link";
import { Calendar, MapPin, Trophy, Shield } from "lucide-react";
import { PublicMatchItem } from "@/lib/public/matches";

interface MatchCardProps {
  match: PublicMatchItem;
  locale: string;
  labels: {
    scheduled: string;
    live: string;
    finished: string;
    postponed: string;
    cancelled: string;
    details: string;
    home: string;
    away: string;
  };
}

export function MatchCard({ match, locale, labels }: MatchCardProps) {
  const isFinished = match.status === "FINISHED";
  const isLive = match.status === "LIVE";

  const statusLabel =
    match.status === "SCHEDULED"
      ? labels.scheduled
      : match.status === "LIVE"
      ? labels.live
      : match.status === "FINISHED"
      ? labels.finished
      : match.status === "POSTPONED"
      ? labels.postponed
      : labels.cancelled;

  const statusTone =
    match.status === "LIVE"
      ? "bg-red-500/10 text-red-600 border-red-500/20"
      : match.status === "FINISHED"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
      : match.status === "SCHEDULED"
      ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
      : "bg-amber-500/10 text-amber-700 border-amber-500/20";

  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(match.matchDate);

  const formattedTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(match.matchDate);

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-club-primary/40 hover:shadow-md">
      {/* Top Header: Competition & Status Badge */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-muted-foreground truncate">
          <Trophy className="h-3.5 w-3.5 shrink-0 text-club-secondary" />
          <span className="truncate">{match.competitionName}</span>
          {match.teamCategory && (
            <span className="ms-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
              {match.teamCategory}
            </span>
          )}
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${statusTone}`}>
          {statusLabel}
        </span>
      </div>

      {/* Main Scoreboard Area */}
      <div className="my-5 grid grid-cols-5 items-center gap-2">
        {/* Home Team */}
        <div className="col-span-2 flex flex-col items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-muted/40 shadow-xs">
            <Shield className="h-6 w-6 text-club-primary" />
          </div>
          <span className="line-clamp-2 text-sm font-bold text-foreground">
            {match.homeTeamName}
          </span>
        </div>

        {/* Middle Score or Kickoff Time */}
        <div className="col-span-1 flex flex-col items-center justify-center text-center">
          {isFinished || isLive ? (
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 text-base sm:text-xl font-black tracking-tight text-foreground font-mono tabular-nums px-2 py-1 rounded-lg bg-muted/60 border border-border/60">
              <span className="min-w-4 text-center">{match.homeScore ?? 0}</span>
              <span className="text-muted-foreground text-xs font-normal">-</span>
              <span className="min-w-4 text-center">{match.awayScore ?? 0}</span>
            </div>
          ) : (
            <div className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold font-mono text-muted-foreground border border-border/60">
              {formattedTime}
            </div>
          )}
          {isLive && (
            <span className="mt-1 flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </div>

        {/* Away Team */}
        <div className="col-span-2 flex flex-col items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-muted/40 shadow-xs">
            <Shield className="h-6 w-6 text-muted-foreground" />
          </div>
          <span className="line-clamp-2 text-sm font-bold text-foreground">
            {match.awayTeamName}
          </span>
        </div>
      </div>

      {/* Footer Info & Match Center Link */}
      <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-3 truncate">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{formattedDate}</span>
          </div>
          {match.stadium && (
            <div className="hidden items-center gap-1 sm:flex truncate">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{match.stadium}</span>
            </div>
          )}
        </div>

        <Link
          href={`/${locale}/matches/${match.id}`}
          className="font-semibold text-club-primary hover:underline shrink-0 inline-flex items-center gap-1"
        >
          <span>{labels.details}</span>
          <span>{locale === "ar" ? "←" : "→"}</span>
        </Link>
      </div>
    </div>
  );
}
