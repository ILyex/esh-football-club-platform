import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { getAuthorizedTeams } from "@/lib/team-context";
import { Button } from "@/components/ui/button";
import { Timer, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { NewSessionForm } from "@/components/testing/new-session-form";
import { localizeTestProtocol } from "@/lib/testing/localize-protocol";

export default async function NewTestingSessionPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requirePermission("players.view");
  const canManage = hasPermission(user, "testing.manage") || hasPermission(user, "training.manage") || hasPermission(user, "*");
  if (!canManage) {
    redirect(`/${locale}/dashboard/testing`);
  }

  const [t, tTeams, authorizedTeams, protocols] = await Promise.all([
    getTranslations("testing"),
    getTranslations("teams"),
    getAuthorizedTeams(),
    db.testDefinition.findMany({
      where: { active: true },
      orderBy: { displayOrder: "asc" }
    })
  ]);

  // Fetch active squad player counts for each authorized team
  const teamsWithCounts = await Promise.all(
    authorizedTeams.map(async (team) => {
      const count = await db.player.count({
        where: { teamId: team.id, status: { not: "ARCHIVED" } }
      });
      return {
        id: team.id,
        name: team.name || tTeams(`categories.${team.category}` as any),
        category: team.category,
        playerCount: count
      };
    })
  );

  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;
  const defaultDate = new Date().toISOString().slice(0, 16);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/70 pb-4">
        <Link href={`/${locale}/dashboard/testing`}>
          <Button variant="outline" size="sm" className="h-9 w-9 p-0">
            <BackIcon className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <Timer className="h-5 w-5 text-emerald-600" />
            <span>{locale === "ar" ? "جلسة تقييم واختبار جديدة" : t("newSessionTitle")}</span>
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {locale === "ar"
              ? "إعداد بروتوكول الاختبار البدني المعتمد وتحديد التشكيلة المستهدفة قبل النزول إلى الميدان"
              : t("newSessionSubtitle")}
          </p>
        </div>
      </div>

      {/* Modern Stepped Creation Form */}
      <NewSessionForm
        teams={teamsWithCounts}
        protocols={protocols.map((protocol) => ({
          ...protocol,
          name: localizeTestProtocol(t, protocol.code, "name", protocol.name),
          description: localizeTestProtocol(t, protocol.code, "description", protocol.description ?? "")
        }))}
        locale={locale}
        defaultDate={defaultDate}
      />
    </div>
  );
}
