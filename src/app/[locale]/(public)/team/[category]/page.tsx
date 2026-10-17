import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StaffRole, TeamCategory } from "@prisma/client";
import { Users, UserRound, CalendarDays, UsersRound } from "lucide-react";
import { getPublicTeams, getPublicTeamByCategory } from "@/lib/public/teams";
import { PositionGroupsCarousel } from "@/components/public/position-groups-carousel";
import { frenchPublicText } from "@/lib/public/locale-text";
import { PublicPageHeading } from "@/components/public/public-page-heading";
import { getPublicClubSettings } from "@/lib/public/club";
import { isVideoUrl } from "@/lib/media-utils";

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

  const [tPublic, allTeams, teamDetail, tStaff, tTeams, club] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicTeams(),
    getPublicTeamByCategory(categoryUpper),
    getTranslations({ locale, namespace: "staff" }),
    getTranslations({ locale, namespace: "teams" }),
    getPublicClubSettings()
  ]);

  if (!teamDetail) {
    notFound();
  }

  const { playersByPosition, staff } = teamDetail;
  const categorySlug = rawCategory.toLowerCase();
  const categoryDisplayName = tTeams(`categories.${teamDetail.category}` as any) || teamDetail.category;

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
  const staffRoleLabels = Object.fromEntries(
    Object.values(StaffRole).map((role) => [role, tStaff(`roles.${role}` as any)])
  );

  const categoryImages: Record<string, string> = {
    senior: club.websiteImages.teamSenior || "/branding/teams/category-senior.jpg",
    u20: club.websiteImages.teamU20 || "/branding/teams/category-u20.jpg",
    u17: club.websiteImages.teamU17 || "/branding/teams/category-u17.jpg",
    u15: club.websiteImages.teamU15 || "/branding/teams/category-u15.jpg"
  };
  const uploadedCategoryMedia = categoryImages[categorySlug];
  const uploadedCategoryVideo = isVideoUrl(uploadedCategoryMedia);
  const catImg = uploadedCategoryVideo ? `/branding/teams/category-${categorySlug}.jpg` : uploadedCategoryMedia;
  const categoryVideos: Record<string, string> = {
    senior: "/branding/teams/category-senior.mp4",
    u20: "/branding/teams/category-u20.mp4",
    u17: "/branding/teams/category-u17.mp4",
    u15: "/branding/teams/category-u15.mp4"
  };
  const catVideo = uploadedCategoryVideo ? uploadedCategoryMedia : categoryVideos[categorySlug];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Category Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/60 p-2 shadow-xs">
        {allTeams.map((t) => {
          const isActive = t.category === categoryUpper;
          return (
            <Link
              key={t.id}
              href={`/${locale}/team/${t.category.toLowerCase()}`}
              className={`inline-flex min-h-10 items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? "border-club-primary bg-club-primary text-white shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-club-primary/50 hover:text-foreground"
              }`}
            >
              <UsersRound className="me-1.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">
                {tTeams(`categories.${t.category}` as any) || t.category}
              </span>
              <span className="hidden sm:inline">
                {tTeams(`categories.${t.category}` as any) || t.category}
              </span>
            </Link>
          );
        })}
      </div>

      <PublicPageHeading
        locale={locale}
        backHref={`/${locale}/team`}
        backLabel={locale === "ar" ? "كل الفئات" : "Toutes les catégories"}
        icon={<Users />}
        eyebrow={locale === "ar" ? "فئة النادي" : "Catégorie du club"}
        title={categoryDisplayName}
        description={locale === "ar" ? teamDetail.description : frenchPublicText(teamDetail.description, "")}
        className="mt-6"
      />

      {/* Category Banner Hero */}
      {catVideo && (
        <div className="group relative mx-auto mt-6 aspect-[2/1] w-full max-w-5xl overflow-hidden rounded-3xl border border-border/80 shadow-lg">
          <video
            src={catVideo}
            poster={catImg}
            autoPlay
            loop
            muted
            playsInline
            controls={false}
            disablePictureInPicture
            disableRemotePlayback
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none h-full w-full object-cover"
          />
        </div>
      )}

      {/* Team Header */}
      <div className="mt-4 grid gap-2.5 rounded-xl border border-border bg-card p-2.5 shadow-sm sm:mt-6 sm:gap-5 sm:rounded-2xl sm:p-6">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-2">
          <div className="rounded-xl border border-club-primary/15 bg-gradient-to-b from-club-primary/10 to-muted/20 px-2.5 py-2 text-center shadow-xs sm:rounded-xl sm:px-4 sm:py-3">
            <span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-club-primary/15 text-club-primary sm:h-7 sm:w-7">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
            <p className="text-xl font-black leading-none text-foreground sm:text-xl">{teamDetail.totalPlayers}</p>
            <p className="mt-1 text-[10px] font-medium leading-tight text-muted-foreground sm:text-[11px]">{locale === "ar" ? "اللاعبون" : "Joueurs"}</p>
          </div>
          <div className="rounded-xl border border-blue-500/15 bg-gradient-to-b from-blue-500/10 to-muted/20 px-2.5 py-2 text-center shadow-xs sm:rounded-xl sm:px-4 sm:py-3">
            <span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 sm:h-7 sm:w-7">
              <UserRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
            <p className="text-xl font-black leading-none text-foreground sm:text-xl">{staff.length}</p>
            <p className="mt-1 text-[10px] font-medium leading-tight text-muted-foreground sm:text-[11px]">{locale === "ar" ? "الطاقم" : "Staff"}</p>
          </div>
          {(teamDetail.birthYearFrom != null || teamDetail.birthYearTo != null) && (
            <div className="hidden rounded-xl border border-border bg-muted/20 px-4 py-3 text-center sm:block">
            <CalendarDays className="mx-auto mb-1 h-4 w-4 text-club-primary" />
              <p className="text-xl font-black text-foreground">
                {teamDetail.birthYearFrom ?? "—"}{teamDetail.birthYearTo != null ? `–${teamDetail.birthYearTo}` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground">{locale === "ar" ? "سنوات الميلاد" : "Années de naissance"}</p>
            </div>
          )}
        </div>
      </div>

      <PositionGroupsCarousel
        groups={positionGroups}
        locale={locale}
        categorySlug={categorySlug}
        labels={playerCardLabels}
        emptyLabel={tPublic("teams.noPlayers")}
        playerLabel={locale === "ar" ? "لاعب" : "joueurs"}
        staff={staff}
        staffTitle={locale === "ar" ? "الطاقم الفني" : "Staff Technique"}
        staffRoleLabels={staffRoleLabels}
      />
    </div>
  );
}
