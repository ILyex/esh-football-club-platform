import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { resolveUserTeamContext } from "@/lib/team-context";
import { TacticalBoard } from "@/components/tactics/tactical-board";

export default async function TacticalPlanningPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ plan?: string }> }) {
  const [{ locale }, { plan: initialPlanId }] = await Promise.all([params, searchParams]);
  const user = await requirePagePermission("training.view", locale);
  const context = await resolveUserTeamContext();
  const teamIds = context.authorizedTeams.map((team) => team.id);
  const [plans, clubSettings, coachRecords] = await Promise.all([
    db.tacticalPlan.findMany({
      where: { OR: [{ teamId: { in: teamIds } }, { teamId: null, creatorId: user.id }] },
      include: { team: { select: { id: true, name: true, category: true } }, creator: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100
    }),
    db.clubSettings.findUnique({ where: { id: "singleton" }, select: { logoUrl: true } }),
    teamIds.length > 0 ? db.staff.findMany({
      where: {
        status: "ACTIVE",
        role: { in: ["HEAD_COACH", "ASSISTANT_COACH"] },
        OR: [
          { teamId: { in: teamIds } },
          { teamAssignments: { some: { teamId: { in: teamIds } } } }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        firstNameFr: true,
        lastNameFr: true,
        teamId: true,
        teamAssignments: { select: { teamId: true } }
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    }) : Promise.resolve([])
  ]);
  const teams = context.authorizedTeams.map(({ id, name, category }) => ({ id, name, category }));
  const coaches = coachRecords.map((coach) => ({
    id: coach.id,
    label: locale === "fr"
      ? `${coach.firstNameFr || coach.firstName} ${coach.lastNameFr || coach.lastName}`.trim()
      : `${coach.firstName} ${coach.lastName}`.trim(),
    teamIds: [...new Set([coach.teamId, ...coach.teamAssignments.map((assignment) => assignment.teamId)].filter((id): id is string => Boolean(id)))]
  }));
  return (
    <TacticalBoard
      locale={locale}
      canEdit={hasPermission(user, "training.manage")}
      initialPlanId={initialPlanId}
      teams={teams}
      coaches={coaches}
      clubLogoUrl={clubSettings?.logoUrl}
      plans={plans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        description: plan.description ?? "",
        formation: plan.formation,
        teamId: plan.teamId,
        teamName: plan.team?.name ?? "",
        creatorName: plan.creator.name,
        isOwner: plan.creatorId === user.id,
        data: plan.data,
        updatedAt: plan.updatedAt.toISOString()
      }))}
    />
  );
}
