import Link from "next/link";
import { Calendar, CircleDot, Flag, Goal, ShieldCheck, Target, User } from "lucide-react";
import { PublicPlayerItem } from "@/lib/public/teams";
import { getPlayerDisplayName } from "@/lib/utils";
import { frenchPublicPersonName, localizedNationality } from "@/lib/public/locale-text";
import { SafeImage } from "@/components/shared/safe-image";

interface PlayerCardProps {
  player: PublicPlayerItem;
  locale: string;
  categorySlug: string;
  positionLabel: string;
  labels: {
    age: string;
    yearsOld: string;
    viewProfile: string;
  };
}

export function PlayerCard({
  player,
  locale,
  categorySlug,
  positionLabel,
  labels
}: PlayerCardProps) {
  const positionColorMap: Record<string, string> = {
    GOALKEEPER: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    DEFENDER: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    MIDFIELDER: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    FORWARD: "bg-rose-500/10 text-rose-700 border-rose-500/20"
  };
  const positionIconMap = { GOALKEEPER: Goal, DEFENDER: ShieldCheck, MIDFIELDER: CircleDot, FORWARD: Target };
  const PositionIcon = positionIconMap[player.position as keyof typeof positionIconMap] ?? CircleDot;

  const badgeColor = positionColorMap[player.position] || "bg-muted text-muted-foreground";

  return (
    <Link
      href={`/${locale}/team/${categorySlug}/players/${player.slug}`}
      aria-label={labels.viewProfile}
      title={labels.viewProfile}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:-translate-y-1 hover:border-club-primary/50 hover:shadow-md"
    >
      {/* Player Photo Area with Shirt Number Badge */}
      <div className="relative aspect-square max-h-56 w-full overflow-hidden bg-muted/60">
        {player.photoUrl ? (
          <SafeImage
            src={player.photoUrl}
            fallbackSrc="/branding/esh-logo-128.png"
            alt={`${player.firstName} ${player.lastName}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-radial from-muted/50 to-muted/80 text-muted-foreground/40">
            <User className="h-16 w-16" />
          </div>
        )}

        {/* Squad Number Badge */}
        {player.shirtNumber && (
          <div className="absolute top-2.5 end-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-card/90 font-mono text-sm font-black text-foreground shadow-sm backdrop-blur-xs">
            {player.shirtNumber}
          </div>
        )}

        {/* Position Tag */}
        <div className="absolute bottom-2.5 start-2.5">
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider backdrop-blur-xs ${badgeColor}`}>
            <PositionIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
            {positionLabel}
          </span>
        </div>
      </div>

      {/* Player Meta Details */}
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-4">
        <div>
          <h3 className="break-words text-center text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-club-primary sm:text-base">
            {locale === "ar" ? getPlayerDisplayName(player, locale) : frenchPublicPersonName(player)}
          </h3>
          <p className="mt-1 flex max-w-full items-center justify-center gap-1 truncate text-xs text-muted-foreground">
            <Flag className="h-3 w-3 shrink-0 text-club-primary" aria-hidden="true" />
            {localizedNationality(player.nationality, locale)}
          </p>
        </div>

        <div className="mt-3 flex min-w-0 items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            <Calendar className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            {player.age} {labels.yearsOld}
          </span>
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-club-primary text-sm font-bold text-white shadow-sm transition-transform group-hover:scale-110 group-hover:bg-club-primary-hover"
          >
            <span>{locale === "ar" ? "←" : "→"}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
