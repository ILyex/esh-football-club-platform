import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { resolveUserTeamContext } from "@/lib/team-context";
import { TacticalBoard } from "@/components/tactics/tactical-board";

export default async function TacticalPlanningPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ plan?: string }> }) {
  const [{ locale }, { plan: initialPlanId }] = await Promise.all([params, searchParams]);
  const user = await requirePagePermission("training.view", locale);
  const context = await resolveUserTeamContext();
  const teamIds = context.authorizedTeams.map((team) => team.id);
  const plans = await db.tacticalPlan.findMany({
    where: { OR: [{ teamId: { in: teamIds } }, { teamId: null, creatorId: user.id }] },
    include: { team: { select: { id: true, name: true, category: true } }, creator: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100
  });
  const teams = context.authorizedTeams.map(({ id, name, category }) => ({ id, name, category }));
  return (
    <TacticalBoard
      locale={locale}
      canEdit={hasPermission(user, "training.manage")}
      initialPlanId={initialPlanId}
      teams={teams}
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
