import { localizedClubName } from "@/lib/public/locale-text";

/** Gives the club and opponent names in the active language for match displays. */
export function getMatchDisplayNames(match: { homeTeamName: string; awayTeamName: string; isHomeFixture: boolean }, locale = "ar") {
  const clubName = locale === "fr" ? "Club Espoir Sidi Hosni" : "نادي أمل سيدي حسني";
  const opponentFallback = locale === "fr" ? "Nom du club adverse" : "الفريق المنافس";
  return {
    homeTeamName: match.isHomeFixture ? clubName : localizedClubName(match.homeTeamName, locale, opponentFallback),
    awayTeamName: match.isHomeFixture ? localizedClubName(match.awayTeamName, locale, opponentFallback) : clubName
  };
}
