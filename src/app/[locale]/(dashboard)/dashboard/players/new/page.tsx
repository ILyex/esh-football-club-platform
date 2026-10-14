import { getTranslations } from "next-intl/server";
import { requirePagePermission } from "@/lib/permissions";
import { resolveUserTeamContext } from "@/lib/team-context";
import { createPlayerAction } from "../actions";
import { NewPlayerForm } from "@/components/players/new-player-form";

export default async function NewPlayerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("players.create", locale);
  const t = await getTranslations("players");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const { authorizedTeams: teams, activeTeamId: currentTeamId } = await resolveUserTeamContext();

  const isAr = locale === "ar";

  const teamCategoryTranslations: Record<string, string> = {};
  for (const team of teams) {
    teamCategoryTranslations[team.category] = tTeams(`categories.${team.category}` as any);
  }

  const positionTranslations: Record<string, string> = {
    GOALKEEPER: t("positions.GOALKEEPER" as any),
    DEFENDER: t("positions.DEFENDER" as any),
    MIDFIELDER: t("positions.MIDFIELDER" as any),
    FORWARD: t("positions.FORWARD" as any)
  };

  const footTranslations: Record<string, string> = {
    RIGHT: t("feet.RIGHT" as any),
    LEFT: t("feet.LEFT" as any),
    BOTH: t("feet.BOTH" as any)
  };

  const translations = {
    nationality: t("fields.nationality"),
    dateOfBirth: t("fields.dateOfBirth"),
    placeOfBirth: t("fields.placeOfBirth"),
    bloodGroup: t("fields.bloodGroup"),
    birthCertificateNumber: t("fields.birthCertificateNumber"),
    team: t("fields.team"),
    position: t("fields.position"),
    preferredFoot: t("fields.preferredFoot"),
    shirtNumber: t("fields.shirtNumber"),
    previousTeam: t("fields.previousTeam"),
    joiningDate: t("fields.joiningDate"),
    height: t("fields.height"),
    weight: t("fields.weight"),
    photo: t("fields.photo"),
    biography: t("fields.biography"),
    save: tCommon("save")
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">{t("addPlayer")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAr
            ? "إضافة وتسجيل لاعب جديد وتوثيق بياناته الرياضية ومستنداته الرسمية في النظام"
            : "Enregistrer un nouveau joueur avec ses informations sportives et ses pièces justificatives"}
        </p>
      </div>

      <NewPlayerForm
        locale={locale}
        createAction={createPlayerAction}
        teams={teams.map((t) => ({ id: t.id, category: t.category }))}
        currentTeamId={currentTeamId}
        translations={translations}
        teamCategoryTranslations={teamCategoryTranslations}
        positionTranslations={positionTranslations}
        footTranslations={footTranslations}
      />
    </div>
  );
}
