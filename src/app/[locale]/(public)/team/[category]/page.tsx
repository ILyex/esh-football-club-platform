import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TeamCategory } from "@prisma/client";
import { Users, Shield, User } from "lucide-react";
import { getPublicTeams, getPublicTeamByCategory } from "@/lib/public/teams";
import { PlayerCard } from "@/components/public/player-card";
import { frenchPublicText } from "@/lib/public/locale-text";

export default async function TeamCategoryPage({
  params
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale, category: rawCategory } = await params;
  const categoryUpper = rawCategory.toUpperCase() as TeamCategory;

  const validCategories = Object.values(TeamCategory);
  if (!validCategories.includes(categoryUpper)) {
    notFound();
  }

  const [tPublic, allTeams, teamDetail, tStaff, tTeams] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicTeams(),
    getPublicTeamByCategory(categoryUpper),
    getTranslations({ locale, namespace: "staff" }),
    getTranslations({ locale, namespace: "teams" })
  ]);

  if (!teamDetail) {
    notFound();
  }

  const { playersByPosition, staff } = teamDetail;
  const categorySlug = rawCategory.toLowerCase();

  const positionGroups = [
    {
      key: "goalkeepers",
      title: tPublic("teams.goalkeepers"),
      players: playersByPosition.goalkeepers,
      positionLabel: tPublic("positions.GOALKEEPER")
    },
    {
      key: "defenders",
      title: tPublic("teams.defenders"),
      players: playersByPosition.defenders,
      positionLabel: tPublic("positions.DEFENDER")
    },
    {
      key: "midfielders",
      title: tPublic("teams.midfielders"),
      players: playersByPosition.midfielders,
      positionLabel: tPublic("positions.MIDFIELDER")
    },
    {
      key: "forwards",
      title: tPublic("teams.forwards"),
      players: playersByPosition.forwards,
      positionLabel: tPublic("positions.FORWARD")
    }
  ];

  const playerCardLabels = {
    age: locale === "ar" ? "العمر" : "Âge",
    yearsOld: tPublic("player.years"),
    viewProfile: tPublic("player.profile")
  };

  const categoryImages: Record<string, string> = {
    senior: "/branding/teams/team-senior.png",
    u20: "/branding/teams/team-u20.png",
    u17: "/branding/teams/team-u17.png",
    u15: "/branding/teams/team-u15.png"
  };
  const catImg = categoryImages[categorySlug];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      {/* Category Switcher Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border/80 pb-6">
        {allTeams.map((t) => {
          const isActive = t.category === categoryUpper;
          return (
            <Link
              key={t.id}
              href={`/${locale}/team/${t.category.toLowerCase()}`}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-club-primary text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {locale === "ar" ? t.name : frenchPublicText(t.name, tTeams(`categories.${t.category}` as any))}
            </Link>
          );
        })}
      </div>

      {/* Category Banner Hero */}
      {catImg && (
        <div className="mt-6 relative aspect-[1024/280] max-h-56 w-full overflow-hidden rounded-2xl border border-border/80 shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={catImg}
            alt={teamDetail.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Team Header */}
      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-club-primary">
            <Users className="h-4 w-4" />
            {tTeams(`categories.${teamDetail.category}` as any) || teamDetail.category}
          </span>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            {locale === "ar" ? teamDetail.name : frenchPublicText(teamDetail.name, tTeams(`categories.${teamDetail.category}` as any))}
          </h1>
          {(locale === "ar" ? teamDetail.description : frenchPublicText(teamDetail.description, "")) && (
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              {locale === "ar" ? teamDetail.description : frenchPublicText(teamDetail.description, "")}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-center sm:text-end">
          <p className="text-2xl font-bold text-club-primary">{teamDetail.totalPlayers}</p>
          <p className="text-xs font-medium text-muted-foreground">
            {locale === "ar" ? "إجمالي اللاعبين" : "Joueurs dans l'effectif"}
          </p>
        </div>
      </div>

      {/* Technical Staff Section (if any active staff) */}
      {staff.length > 0 && (
        <section className="mt-12 space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-club-primary" />
            <span>{locale === "ar" ? "الطاقم الفني والإداري" : "Staff Technique & Administratif"}</span>
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {staff.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
                  {member.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.photoUrl}
                      alt={`${member.firstName} ${member.lastName}`}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {locale === "ar"
                      ? `${member.firstName} ${member.lastName}`
                      : frenchPublicText(`${member.firstName} ${member.lastName}`, "Membre du staff")}
                  </h3>
                  <p className="text-xs font-semibold text-club-primary">
                    {tStaff(`roles.${member.role}` as any) || (locale === "ar" ? member.role : frenchPublicText(member.role, "Staff technique"))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Players By Position Groups */}
      <div className="mt-12 space-y-12">
        {positionGroups.map((group) => (
          <section key={group.key} className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h2 className="text-xl font-bold text-foreground">{group.title}</h2>
              <span className="text-xs font-semibold text-muted-foreground">
                {group.players.length} {locale === "ar" ? "لاعب" : "joueurs"}
              </span>
            </div>

            {group.players.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {group.players.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    locale={locale}
                    categorySlug={categorySlug}
                    positionLabel={group.positionLabel}
                    labels={playerCardLabels}
                  />
                ))}
              </div>
            ) : (
              <p className="py-4 text-xs italic text-muted-foreground">
                {tPublic("teams.noPlayers")}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
