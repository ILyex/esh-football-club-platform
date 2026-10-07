import Link from "next/link";
import { User } from "lucide-react";
import { PublicPlayerItem } from "@/lib/public/teams";
import { getPlayerDisplayName } from "@/lib/utils";
import { frenchPublicPersonName, frenchNationality } from "@/lib/public/locale-text";

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

  const badgeColor = positionColorMap[player.position] || "bg-muted text-muted-foreground";

  return (
    <Link
      href={`/${locale}/team/${categorySlug}/players/${player.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all hover:-translate-y-1 hover:border-club-primary/50 hover:shadow-md"
    >
      {/* Player Photo Area with Shirt Number Badge */}
      <div className="relative aspect-4/3 w-full overflow-hidden bg-muted/60">
        {player.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.photoUrl}
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
          <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider backdrop-blur-xs ${badgeColor}`}>
            {positionLabel}
          </span>
        </div>
      </div>

      {/* Player Meta Details */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="text-base font-bold text-foreground group-hover:text-club-primary transition-colors">
            {locale === "ar" ? getPlayerDisplayName(player, locale) : frenchPublicPersonName(player)}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {locale === "ar" ? player.nationality : frenchNationality(player.nationality)}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
          <span>
            {player.age} {labels.yearsOld}
          </span>
          <span className="font-semibold text-club-primary group-hover:underline inline-flex items-center gap-1">
            <span>{labels.viewProfile}</span>
            <span>{locale === "ar" ? "←" : "→"}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
