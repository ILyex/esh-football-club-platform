import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Users, ArrowRight, ArrowLeft } from "lucide-react";
import { getPublicTeams } from "@/lib/public/teams";
import { frenchPublicText } from "@/lib/public/locale-text";

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
      {/* Header */}
      <div className="border-b border-border/80 pb-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-club-primary">
          <Users className="h-4 w-4" />
          {tPublic("teams.title")}
        </span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
          {tPublic("teams.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-2xl">
          {tPublic("teams.subtitle")}
        </p>
      </div>

      {/* Team Cards Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => {
          const catImg = categoryImages[team.category.toLowerCase()];
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
                    alt={team.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-club-primary/10 px-2.5 py-1 text-xs font-bold text-club-primary">
                      {tTeams(`categories.${team.category}` as any) || team.category}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {team.playerCount} {locale === "ar" ? "لاعب" : "joueurs"}
                    </span>
                  </div>

                  <h2 className="mt-4 text-xl font-bold text-foreground transition-colors group-hover:text-club-primary">
                    {locale === "ar" ? team.name : frenchPublicText(team.name, tTeams(`categories.${team.category}` as any))}
                  </h2>

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
