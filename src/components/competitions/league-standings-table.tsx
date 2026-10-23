"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  RotateCcw,
  Sparkles,
  Edit3,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { OpponentCrest } from "@/components/public/opponent-crest";
import type { StandingTeamEntry } from "@/lib/competitions/types";
import { rankStandings } from "@/lib/competitions/standings";
import { saveCompetitionManualPointsAction } from "@/app/[locale]/(dashboard)/dashboard/competitions/actions";

interface LeagueStandingsTableProps {
  competitionId: string;
  standings: StandingTeamEntry[];
  locale: string;
  canManage?: boolean;
  clubName?: string;
  isPublic?: boolean;
}

export function LeagueStandingsTable({
  competitionId,
  standings: initialStandings,
  locale,
  canManage = false,
  clubName = "أمل سيدي حسني (ESH)",
  isPublic = false
}: LeagueStandingsTableProps) {
  const isAr = locale === "ar";
  const router = useRouter();
  const [standings, setStandings] = useState<StandingTeamEntry[]>(initialStandings);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Auto-sort function
  const handleAutoSort = () => {
    setStandings(rankStandings(standings));
  };

  const handleManualPointsChange = (id: string, points: number) => {
    setStandings((prev) => prev.map((item) => item.id === id ? { ...item, points } : item));
  };

  const handleSave = () => {
    const pointChanges = standings.map(({ id, points }) => ({ id, points }));
    startTransition(async () => {
      try {
        setFeedback(null);
        const result = await saveCompetitionManualPointsAction(competitionId, pointChanges);
        setStandings(result.standings);
        setIsEditing(false);
        setFeedback({
          type: "success",
          message: isAr ? "تم حفظ النقاط اليدوية مع استمرار احتساب نتائج المباريات" : "Points manuels enregistrés, les résultats restent automatiques"
        });
        router.refresh();
        setTimeout(() => setFeedback(null), 4000);
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: err?.message || (isAr ? "فشل في حفظ الترتيب" : "Erreur de mise à jour")
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Table Actions Header (Only for Admin when not public) */}
      {!isPublic && canManage && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {isAr ? "إدارة الترتيب (الفوز 3، التعادل 1):" : "Classement (victoire 3 pts, nul 1 pt) :"}
            </span>
            {feedback && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${
                  feedback.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                {feedback.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {feedback.message}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleAutoSort}
                  title={isAr ? "النقاط ثم فارق الأهداف ثم الأهداف المسجلة؛ التعادل الإحصائي يشترك في المركز" : "Points, différence puis buts marqués ; les égalités statistiques partagent le rang"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-club-primary" />
                  <span>{isAr ? "ترتيب تلقائي" : "Trier"}</span>
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-club-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-club-primary/90 transition-colors disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isPending ? (isAr ? "جاري الحفظ..." : "Enregistrement...") : isAr ? "حفظ التغييرات" : "Enregistrer"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setStandings(initialStandings);
                  }}
                  className="inline-flex items-center rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  {isAr ? "إلغاء" : "Annuler"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:border-club-primary hover:text-club-primary transition-colors shadow-2xs"
              >
                <Edit3 className="h-3.5 w-3.5 text-club-primary" />
                <span>{isAr ? "تعديل جدول الترتيب" : "Modifier le classement"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Standings Table Container */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs sm:rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-start text-[11px] sm:min-w-0 sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
                <th className="w-8 px-1 py-2 text-center sm:w-12 sm:px-3 sm:py-3">{isAr ? "#" : "Pos"}</th>
                <th className="min-w-[150px] px-1.5 py-2 text-start sm:min-w-[200px] sm:px-4 sm:py-3">{isAr ? "النادي / الفريق" : "Club / Équipe"}</th>
                <th className="px-1 py-2 text-center sm:px-2.5 sm:py-3">{isAr ? "لعب" : "J"}</th>
                <th className="px-1 py-2 text-center sm:px-2.5 sm:py-3">{isAr ? "فاز" : "G"}</th>
                <th className="px-1 py-2 text-center sm:px-2.5 sm:py-3">{isAr ? "تعادل" : "N"}</th>
                <th className="px-1 py-2 text-center sm:px-2.5 sm:py-3">{isAr ? "خسر" : "P"}</th>
                <th className="py-3 px-2.5 text-center hidden md:table-cell">{isAr ? "له" : "BP"}</th>
                <th className="py-3 px-2.5 text-center hidden md:table-cell">{isAr ? "عليه" : "BC"}</th>
                <th className="hidden px-2.5 py-3 text-center font-semibold sm:table-cell">{isAr ? "الفارق" : "Diff"}</th>
                <th className="bg-muted/40 px-1.5 py-2 text-center font-black text-foreground sm:px-4 sm:py-3">{isAr ? "النقاط" : "Pts"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {standings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {isAr ? "لا توجد بيانات ترتيب موثقة لهذا الدوري بعد." : "Aucun classement vérifié n’est encore disponible pour ce championnat."}
                    {!isPublic && canManage && !isEditing && <span className="block mt-1">{isAr ? "ابدأ بإضافة الفرق وإدخال نتائجها الفعلية." : "Ajoutez les équipes et saisissez leurs résultats réels."}</span>}
                  </td>
                </tr>
              ) : standings.map((team, idx) => {
                const isOur = team.isOurClub;
                return (
                  <tr
                    key={team.id || idx}
                    className={`transition-all duration-200 ${
                      isOur
                        ? "bg-red-500/10 dark:bg-red-600/15 border-s-4 border-s-club-primary font-bold shadow-xs relative"
                        : idx % 2 === 0
                        ? "bg-card hover:bg-muted/30"
                        : "bg-muted/15 hover:bg-muted/30"
                    }`}
                  >
                    {/* Rank */}
                    <td className="px-1 py-2 text-center sm:px-3 sm:py-3">
                      <div className="flex items-center justify-center">
                        <span
                          className={`inline-flex items-center justify-center h-6 w-6 rounded-full font-mono text-xs font-black ${
                            isOur
                              ? "bg-club-primary text-white shadow-sm ring-2 ring-club-primary/30"
                              : idx === 0
                              ? "bg-amber-400/20 text-amber-600 dark:text-amber-400 border border-amber-400/30"
                              : idx === 1
                              ? "bg-slate-300/30 text-slate-700 dark:text-slate-300"
                              : idx === 2
                              ? "bg-amber-700/20 text-amber-800 dark:text-amber-300"
                              : "text-muted-foreground"
                          }`}
                        >
                          {team.rank}
                        </span>
                      </div>
                    </td>

                    {/* Team Name + Logo */}
                    <td className="min-w-0 px-1.5 py-2 text-start sm:px-4 sm:py-3">
                      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
                        {/* Team Logo Badge */}
                        <div
                            className={`relative h-6 w-6 shrink-0 rounded-full overflow-hidden flex items-center justify-center border transition-transform sm:h-8 sm:w-8 ${
                            isOur
                              ? "border-club-primary bg-background shadow-xs ring-2 ring-club-primary/30 scale-105"
                              : "border-border/80 bg-muted/40"
                          }`}
                        >
                          <OpponentCrest
                            src={team.teamLogo}
                            alt={team.teamName}
                            className="h-full w-full object-contain p-0.5"
                            iconClassName={`h-4 w-4 ${isOur ? "text-club-primary" : "text-muted-foreground"}`}
                          />
                        </div>

                        {/* Name Input or Label */}
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span
                            className={`truncate font-bold ${
                            isOur
                                ? "text-club-primary dark:text-red-400 text-[11px] tracking-wide sm:text-sm"
                                : "text-foreground"
                            }`}
                          >
                            {team.teamName}
                          </span>

                          {/* Distinctive Our Club Tag */}
                          {isOur && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-club-primary px-2.5 py-0.5 text-[10px] font-black text-white shadow-xs uppercase tracking-wider">
                              <Sparkles className="h-3 w-3 animate-pulse" />
                              <span>{isAr ? "نحن" : "Notre Club"}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Stats */}
                    <td className="py-3 px-2.5 text-center font-mono">{team.played}</td>
                    <td className="py-3 px-2.5 text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{team.won}</td>
                    <td className="py-3 px-2.5 text-center font-mono text-amber-600 dark:text-amber-400">{team.drawn}</td>
                    <td className="py-3 px-2.5 text-center font-mono text-red-600 dark:text-red-400">{team.lost}</td>
                    <td className="py-3 px-2.5 text-center font-mono hidden md:table-cell">{team.goalsFor}</td>
                    <td className="py-3 px-2.5 text-center font-mono hidden md:table-cell">{team.goalsAgainst}</td>
                    <td className="hidden py-3 px-2.5 text-center font-mono font-bold sm:table-cell">
                      <span className={team.goalDifference > 0 ? "text-emerald-600 dark:text-emerald-400" : team.goalDifference < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                        {team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}
                      </span>
                    </td>
                    <td className={`py-3 px-2 text-center font-mono font-black text-base tabular-nums ${isOur ? "bg-club-primary/10 text-club-primary dark:text-red-400 font-extrabold" : "text-foreground bg-muted/40"}`}>
                      {isEditing ? <input type="number" step="1" value={team.points} onChange={(event) => handleManualPointsChange(team.id, Number.parseInt(event.target.value, 10) || 0)} aria-label={isAr ? `نقاط ${team.teamName}` : `Points ${team.teamName}`} className="w-14 rounded-md border border-club-primary/30 bg-background px-1 py-1 text-center text-sm font-bold focus:border-club-primary focus:outline-none" /> : team.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-club-primary" />
              <span>{isAr ? "فريق الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football (Notre Club)"}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span>{isAr ? "متصدر الترتيب الصعود الى الجهوي الثاني" : "Leader (Accession en Régionale 2)"}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
