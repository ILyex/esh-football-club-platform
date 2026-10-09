import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Users, ArrowRight, ArrowLeft } from "lucide-react";
import { getPublicTeams } from "@/lib/public/teams";
import { frenchPublicText, localizedClubName } from "@/lib/public/locale-text";
import { PublicPageHeading } from "@/components/public/public-page-heading";

export default async function TeamsOverviewPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = locale === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const [tPublic, tTeams, teams] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getTranslations({ locale, namespace: "teams" }),
    getPublicTeams()
  ]);

  const categoryImages: Record<string, string> = {
    senior: "/branding/teams/team-senior.png",
    u20: "/branding/teams/team-u20.png",
    u17: "/branding/teams/team-u17.png",
    u15: "/branding/teams/team-u15.png"
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PublicPageHeading locale={locale} icon={<Users />} eyebrow={tPublic("teams.title")} title={tPublic("teams.title")} description={tPublic("teams.subtitle")} />

      {/* Team Cards Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => {
          const catImg = categoryImages[team.category.toLowerCase()];
          const categoryLabel = tTeams(`categories.${team.category}` as any) || team.category;
          const teamDisplayName = localizedClubName(team.name, locale, categoryLabel);
          const showTeamName = teamDisplayName.trim() !== categoryLabel.trim();
          return (
            <Link
              key={team.id}
              href={`/${locale}/team/${team.category.toLowerCase()}`}
              className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all hover:-translate-y-1 hover:border-club-primary/50 hover:shadow-md"
            >
              {catImg && (
                <div className="relative aspect-[507/249] w-full overflow-hidden border-b border-border/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={catImg}
                    alt={localizedClubName(team.name, locale, tTeams(`categories.${team.category}` as any))}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-club-primary/10 px-2.5 py-1 text-xs font-bold text-club-primary">
                      {categoryLabel}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {team.playerCount} {locale === "ar" ? "لاعب" : "joueurs"}
                    </span>
                  </div>

                  {showTeamName && (
                    <h2 className="mt-4 text-xl font-bold text-foreground transition-colors group-hover:text-club-primary">
                      {teamDisplayName}
                    </h2>
                  )}

              {(locale === "ar" ? team.description : frenchPublicText(team.description, "")) && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {locale === "ar" ? team.description : frenchPublicText(team.description, "")}
                </p>
              )}

              {(team.birthYearFrom || team.birthYearTo) && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {locale === "ar" ? "سنوات الميلاد: " : "Années de naissance: "}
                  <span className="font-semibold text-foreground">
                    {team.birthYearFrom ?? "..."} - {team.birthYearTo ?? "..."}
                  </span>
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-sm font-semibold text-club-primary">
              <span>{tPublic("teams.squad")}</span>
              <Arrow className={`h-4 w-4 transition-transform ${isRtl ? "group-hover:-translate-x-1" : "group-hover:translate-x-1"}`} />
            </div>
          </div>
        </Link>
        );
      })}
      </div>
    </div>
  );
}
