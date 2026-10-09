import Link from "next/link";
import { ArrowLeft, ArrowRight, Trophy } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { getCurrentTeamId } from "@/lib/team-context";
import { createMatchAction } from "../actions";
import { redirect } from "next/navigation";
import { getAllOpponentsList } from "@/lib/opponents";
import { MatchFormClient } from "@/components/matches/match-form-client";
import { localizedClubName } from "@/lib/public/locale-text";
import { getMatchFormError } from "@/lib/matches/form-error";

export default async function NewMatchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("matches.create", locale);
  const t = await getTranslations("matches");
  const tTeams = await getTranslations("teams");

  const [competitions, teams, currentTeamId, savedOpponents, players] = await Promise.all([
    db.competition.findMany({ orderBy: { name: "asc" } }),
    db.team.findMany({ where: { active: true }, orderBy: { category: "asc" } }),
    getCurrentTeamId(),
    getAllOpponentsList(),
    db.player.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] })
  ]);

  async function action(formData: FormData) {
    "use server";
    let result: { id: string };
    try {
      result = await createMatchAction(formData);
    } catch (error) {
      return getMatchFormError(error, locale);
    }
    const { id } = result;
    redirect(`/${locale}/dashboard/matches/${id}`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-border/70 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-foreground">{t("addMatch")}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {locale === "ar"
            ? "برمجة مباراة رسمية جديدة، تحديد المضيف والضيف، رفع شعار الخصم، ونشرها المباشر على الموقع الرسمي"
            : "Planification d'un nouveau match, gestion des logos et publication directe sur le portail public"}
        </p>
      </div>

      {competitions.length === 0 ? (
        <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="font-bold text-foreground">
                {locale === "ar" ? "أضف مسابقة قبل تسجيل المباراة" : "Créez une compétition avant le match"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {locale === "ar"
                  ? "لا توجد مسابقات مرتبطة بموسم بعد. أنشئ المسابقة أولاً، ثم ارجع إلى هنا لإضافة المباراة."
                  : "Aucune compétition n’est encore liée à une saison. Créez d’abord une compétition, puis revenez ici pour ajouter le match."}
              </p>
              <Link
                href={`/${locale}/dashboard/competitions/new`}
                className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-club-primary px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <span>{locale === "ar" ? "إضافة مسابقة" : "Ajouter une compétition"}</span>
                {locale === "ar" ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <MatchFormClient
          locale={locale}
          competitions={competitions.map((c) => ({ id: c.id, name: c.name, teamId: c.teamId }))}
          teams={teams.map((tm) => ({ id: tm.id, name: localizedClubName(tm.name, locale, tTeams(`categories.${tm.category}` as any)), category: tm.category }))}
          players={players.map((player) => ({ id: player.id, firstName: player.firstName, lastName: player.lastName, position: player.position, status: player.status, teamId: player.teamId }))}
          savedOpponents={savedOpponents}
          defaultTeamId={currentTeamId}
          clubName={
            locale === "ar"
              ? "نادي أمل سيدي حسني"
              : "Club Espoir Sidi Hosni"
          }
          action={action}
        />
      )}
    </div>
  );
}
