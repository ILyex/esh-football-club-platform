import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { resolveUserTeamContext } from "@/lib/team-context";
import { SavedTacticalPlans } from "@/components/tactics/saved-tactical-plans";

export default async function SavedTacticalPlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requirePagePermission("training.view", locale);
  const context = await resolveUserTeamContext();
  const teamIds = context.authorizedTeams.map((team) => team.id);
  const plans = await db.tacticalPlan.findMany({
    where: { OR: [{ teamId: { in: teamIds } }, { teamId: null, creatorId: user.id }] },
    include: { team: { select: { id: true, name: true } }, creator: { select: { name: true } } },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    take: 100
  });
  return <SavedTacticalPlans locale={locale} canEdit={hasPermission(user, "training.manage")} plans={plans.map((plan) => {
    const data = plan.data && typeof plan.data === "object" && !Array.isArray(plan.data) ? plan.data as Record<string, unknown> : {};
    return {
      id: plan.id,
      title: plan.title,
      description: plan.description ?? "",
      formation: plan.formation,
      teamId: plan.teamId,
      teamName: plan.team?.name ?? "",
      creatorName: plan.creator.name,
      coachName: typeof data.coachName === "string" ? data.coachName : "",
      isOwner: plan.creatorId === user.id,
      data: plan.data,
      updatedAt: plan.updatedAt.toISOString()
    };
  })}/>;
}
