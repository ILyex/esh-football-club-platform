"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  Trophy,
  Shield,
  Edit3,
  Save,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  Award,
  Plus
} from "lucide-react";
import { type CupBracketData, type CupMatchEntry } from "@/lib/competitions/types";
import { saveCompetitionBracketAction } from "@/app/[locale]/(dashboard)/dashboard/competitions/actions";

interface CupKnockoutBracketProps {
  competitionId: string;
  bracket: CupBracketData;
  locale: string;
  canManage?: boolean;
  clubName?: string;
  isPublic?: boolean;
}

export function CupKnockoutBracket({
  competitionId,
  bracket: initialBracket,
  locale,
  canManage = false,
  clubName = "أمل سيدي حسني (ESH)",
  isPublic = false
}: CupKnockoutBracketProps) {
  const isAr = locale === "ar";
  const [bracket, setBracket] = useState<CupBracketData>(initialBracket);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const roundDefinitions = [
    { key: "ROUND_OF_16", labelAr: "دور الـ16", labelFr: "Huitièmes de finale" },
    { key: "QUARTER_FINAL", labelAr: "ربع النهائي", labelFr: "Quarts de finale" },
    { key: "SEMI_FINAL", labelAr: "نصف النهائي", labelFr: "Demi-finales" },
    { key: "FINAL", labelAr: "النهائي", labelFr: "Finale" }
  ] as const;

  const handleAddRound = () => {
    const definition = roundDefinitions.find((candidate) => !bracket.rounds.some((round) => round.roundKey === candidate.key));
    if (!definition) return;
    setBracket((previous) => ({
      rounds: [...previous.rounds, { roundKey: definition.key, labelAr: definition.labelAr, labelFr: definition.labelFr, matches: [] }]
        .sort((a, b) => roundDefinitions.findIndex((round) => round.key === a.roundKey) - roundDefinitions.findIndex((round) => round.key === b.roundKey))
    }));
  };

  const handleAddMatch = (roundKey: string) => {
    setBracket((previous) => ({
      rounds: previous.rounds.map((round) => round.roundKey !== roundKey ? round : {
        ...round,
        matches: [...round.matches, {
          id: crypto.randomUUID(),
          round: round.roundKey,
          matchOrder: round.matches.length + 1,
          homeTeam: { name: "", score: null },
          awayTeam: { name: "", score: null },
          winner: null,
          status: "SCHEDULED"
        }]
      })
    }));
  };

  const handleScoreChange = (
    roundKey: string,
    matchId: string,
    side: "home" | "away",
    scoreVal: string
  ) => {
    const num = scoreVal === "" ? null : Math.max(0, parseInt(scoreVal) || 0);
    setBracket((prev) => ({
      rounds: prev.rounds.map((r) => {
        if (r.roundKey !== roundKey) return r;
        return {
          ...r,
          matches: r.matches.map((m) => {
            if (m.id !== matchId) return m;
            return {
              ...m,
              winner: null,
              status: "SCHEDULED" as const,
              [side === "home" ? "homeTeam" : "awayTeam"]: {
                ...m[side === "home" ? "homeTeam" : "awayTeam"],
                score: num
              }
            };
          })
        };
      })
    }));
  };

  const handlePenaltyChange = (roundKey: string, matchId: string, side: "home" | "away", value: string) => {
    const penalties = value === "" ? null : Math.max(0, parseInt(value, 10) || 0);
    setBracket((prev) => ({
      rounds: prev.rounds.map((round) => round.roundKey !== roundKey ? round : {
        ...round,
        matches: round.matches.map((match) => match.id !== matchId ? match : {
          ...match,
          winner: null,
          status: "SCHEDULED" as const,
          [side === "home" ? "homeTeam" : "awayTeam"]: {
            ...match[side === "home" ? "homeTeam" : "awayTeam"],
            penalties
          }
        })
      })
    }));
  };

  const handleWinnerChange = (roundKey: string, matchId: string, winner: "HOME" | "AWAY" | null) => {
    const match = bracket.rounds.find((round) => round.roundKey === roundKey)?.matches.find((entry) => entry.id === matchId);
    if (!match) return;
    if (winner) {
      const homeScore = match.homeTeam.score;
      const awayScore = match.awayTeam.score;
      if (homeScore == null || awayScore == null) {
        setFeedback({ type: "error", message: isAr ? "أدخل نتيجتي الفريقين أولًا." : "Saisissez d’abord les deux scores." });
        return;
      }
      const expectedWinner = homeScore > awayScore ? "HOME" : homeScore < awayScore ? "AWAY" :
        match.homeTeam.penalties != null && match.awayTeam.penalties != null && match.homeTeam.penalties !== match.awayTeam.penalties
          ? match.homeTeam.penalties > match.awayTeam.penalties ? "HOME" : "AWAY"
          : null;
      if (!expectedWinner || winner !== expectedWinner) {
        setFeedback({ type: "error", message: isAr ? "الفائز يجب أن يطابق النتيجة وركلات الترجيح." : "Le vainqueur doit correspondre au score et aux tirs au but." });
        return;
      }
    }
    setBracket((prev) => ({
      rounds: prev.rounds.map((r) => {
        if (r.roundKey !== roundKey) return r;
        return {
          ...r,
          matches: r.matches.map((m) => {
            if (m.id !== matchId) return m;
            return { ...m, winner, status: winner ? "FINISHED" : "SCHEDULED" };
          })
        };
      })
    }));
  };

  const handleTeamNameChange = (
    roundKey: string,
    matchId: string,
    side: "home" | "away",
    name: string
  ) => {
    setBracket((prev) => ({
      rounds: prev.rounds.map((r) => {
        if (r.roundKey !== roundKey) return r;
        return {
          ...r,
          matches: r.matches.map((m) => {
            if (m.id !== matchId) return m;
            return {
              ...m,
              [side === "home" ? "homeTeam" : "awayTeam"]: {
                ...m[side === "home" ? "homeTeam" : "awayTeam"],
                name
              }
            };
          })
        };
      })
    }));
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        setFeedback(null);
        await saveCompetitionBracketAction(competitionId, bracket);
        setIsEditing(false);
        setFeedback({
          type: "success",
          message: isAr ? "تم حفظ هيكل أدوار كأس الجزائر بنجاح" : "Tableau de coupe mis à jour avec succès"
        });
        setTimeout(() => setFeedback(null), 4000);
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: err?.message || (isAr ? "فشل حفظ التعديلات" : "Erreur de sauvegarde")
        });
      }
    });
  };

  // Find final match
  const finalRound = bracket.rounds.find((r) => r.roundKey === "FINAL");
  const finalMatch = finalRound?.matches[0];

  return (
    <div className="space-y-8">
      {/* Admin Control Bar */}
      {!isPublic && canManage && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {isAr ? "إدارة مباريات وأدوار كأس الجزائر:" : "Gestion des tours de la Coupe d'Algérie:"}
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
                {bracket.rounds.length < roundDefinitions.length && (
                  <button type="button" onClick={handleAddRound} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                    <Plus className="h-3.5 w-3.5" />{isAr ? "إضافة دور" : "Ajouter un tour"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-club-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-club-primary/90 transition-colors disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isPending ? (isAr ? "جاري الحفظ..." : "Enregistrement...") : isAr ? "حفظ الأدوار" : "Enregistrer"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setBracket(initialBracket);
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
                <span>{isAr ? "تعديل مباريات الكأس" : "Modifier le tableau"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* HIGHLIGHTED FINALS SHOWCASE (Trophy between the two finalists' logos!) */}
      {finalMatch && (
        <div className="relative overflow-hidden rounded-3xl border-2 border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-card to-card p-6 md:p-8 shadow-lg text-center">
          {/* Subtle Background Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-56 w-96 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />

          {/* Title Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1 text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest shadow-2xs mb-6">
            <Trophy className="h-4 w-4" />
            <span>{isAr ? "المباراة النهائية — نهائي كأس الجزائر" : "FINALE OFFICIELLE — COUPE D'ALGÉRIE"}</span>
          </div>

          {/* Match Showdown: Home Team vs Trophy vs Away Team */}
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 my-4">
            {/* Team 1 (Home) */}
            <div className="flex flex-col items-center gap-3 w-full max-w-[200px]">
              <div
                className={`relative h-20 w-20 md:h-24 md:w-24 rounded-2xl flex items-center justify-center p-2 border-2 transition-transform hover:scale-105 shadow-md ${
                  finalMatch.homeTeam.isOurClub
                    ? "border-club-primary bg-club-primary/10 ring-4 ring-club-primary/20"
                    : "border-border bg-card"
                }`}
              >
                {finalMatch.homeTeam.logo ? (
                  <img
                    src={finalMatch.homeTeam.logo}
                    alt={finalMatch.homeTeam.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Shield className={`h-12 w-12 ${finalMatch.homeTeam.isOurClub ? "text-club-primary" : "text-muted-foreground"}`} />
                )}
              </div>
              <div className="text-center">
                <span className="font-bold text-sm md:text-base text-foreground block">
                  {finalMatch.homeTeam.name}
                </span>
                {finalMatch.homeTeam.isOurClub && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-club-primary px-2 py-0.5 text-[10px] font-black text-white shadow-2xs mt-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    {isAr ? "نحن" : "Notre Club"}
                  </span>
                )}
              </div>
              {finalMatch.homeTeam.score !== null && (
                <span className="text-2xl md:text-3xl font-black font-mono text-foreground">
                  {finalMatch.homeTeam.score}
                </span>
              )}
            </div>

            {/* THE CUP IN THE MIDDLE (Direct user requirement: "و في النهائي بين لوغوهين الفريقين يكون كأس") */}
            <div className="flex flex-col items-center justify-center shrink-0 my-2 md:my-0">
              <div className="relative group">
                <div className="absolute -inset-3 rounded-full bg-amber-400/30 blur-md group-hover:bg-amber-400/50 transition-all duration-500 animate-pulse" />
                <div className="relative h-20 w-20 md:h-24 md:w-24 rounded-full border-2 border-amber-400 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 flex items-center justify-center shadow-xl">
                  {/* Big Glorious Cup Icon */}
                  <Trophy className="h-10 w-10 md:h-12 md:w-12 text-zinc-950 drop-shadow-md" />
                </div>
              </div>

              <div className="mt-3">
                <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-mono font-bold text-foreground uppercase tracking-widest border border-border">
                  VS
                </span>
              </div>
              {finalMatch.date && (
                <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground mt-2">
                  <Calendar className="h-3 w-3" />
                  <span>{finalMatch.date}</span>
                </div>
              )}
            </div>

            {/* Team 2 (Away) */}
            <div className="flex flex-col items-center gap-3 w-full max-w-[200px]">
              <div
                className={`relative h-20 w-20 md:h-24 md:w-24 rounded-2xl flex items-center justify-center p-2 border-2 transition-transform hover:scale-105 shadow-md ${
                  finalMatch.awayTeam.isOurClub
                    ? "border-club-primary bg-club-primary/10 ring-4 ring-club-primary/20"
                    : "border-border bg-card"
                }`}
              >
                {finalMatch.awayTeam.logo ? (
                  <img
                    src={finalMatch.awayTeam.logo}
                    alt={finalMatch.awayTeam.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Shield className={`h-12 w-12 ${finalMatch.awayTeam.isOurClub ? "text-club-primary" : "text-muted-foreground"}`} />
                )}
              </div>
              <div className="text-center">
                <span className="font-bold text-sm md:text-base text-foreground block">
                  {finalMatch.awayTeam.name}
                </span>
                {finalMatch.awayTeam.isOurClub && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-club-primary px-2 py-0.5 text-[10px] font-black text-white shadow-2xs mt-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    {isAr ? "نحن" : "Notre Club"}
                  </span>
                )}
              </div>
              {finalMatch.awayTeam.score !== null && (
                <span className="text-2xl md:text-3xl font-black font-mono text-foreground">
                  {finalMatch.awayTeam.score}
                </span>
              )}
            </div>
          </div>

          {finalMatch.notes && (
            <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold mt-4">
              {finalMatch.notes}
            </p>
          )}
        </div>
      )}

      {/* COMPLETE TOURNAMENT BRACKET TREE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/80 pb-2">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Award className="h-4 w-4 text-club-primary" />
            <span>{isAr ? "خروج المغلوب" : "Arbre du tournoi à élimination directe"}</span>
          </h3>
          <span className="text-xs text-muted-foreground">
            {isAr ? "من ربع النهائي حتى التتويج" : "Des quarts à la finale"}
          </span>
        </div>

        {bracket.rounds.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
            {isAr ? "لا توجد أدوار أو نتائج كأس موثقة لهذا الموسم." : "Aucun tour ou résultat de coupe vérifié pour cette saison."}
            {!isPublic && canManage && !isEditing && <span className="block mt-1">{isAr ? "ابدأ بتعديل الهيكل لإضافة الأدوار والمباريات الرسمية." : "Modifiez le tableau pour ajouter les tours et matchs officiels."}</span>}
          </div>
        )}

        {/* Horizontal Scrolling Bracket Columns */}
        <div className="overflow-x-auto pb-6 pt-2">
          <div className="min-w-[1000px] grid grid-cols-4 gap-6">
            {bracket.rounds.map((round) => {
              const isFinalRound = round.roundKey === "FINAL";
              const isSemiRound = round.roundKey === "SEMI_FINAL";
              const roundMatchCount = round.matches.length;

              return (
                <div key={round.roundKey} className="flex flex-col space-y-4">
                  {/* Round Header with enhanced badge */}
                  <div
                    className={`rounded-xl border px-3 py-2.5 text-center shadow-xs transition-all ${
                      isFinalRound
                        ? "border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 text-amber-950 dark:text-amber-200"
                        : isSemiRound
                        ? "border-purple-500/30 bg-purple-500/[0.06] text-foreground"
                        : "border-border/80 bg-muted/40 text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {isFinalRound ? (
                          <Trophy className="h-4 w-4 text-amber-500" />
                        ) : isSemiRound ? (
                          <Sparkles className="h-4 w-4 text-purple-500" />
                        ) : (
                          <Shield className="h-4 w-4 text-club-primary" />
                        )}
                        <span className="text-xs font-black uppercase tracking-wider">
                          {isAr ? round.labelAr : round.labelFr}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background/80 border border-border/60 text-muted-foreground">
                        {isAr
                          ? isFinalRound
                            ? "مباراة التتويج"
                            : `${roundMatchCount} مباريات`
                          : isFinalRound
                          ? "Finale"
                          : `${roundMatchCount} matchs`}
                      </span>
                    </div>
                  </div>

                  {isEditing && (
                    <button type="button" onClick={() => handleAddMatch(round.roundKey)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-border px-2 py-2 text-xs text-muted-foreground hover:border-club-primary hover:text-club-primary">
                      <Plus className="h-3.5 w-3.5" />{isAr ? "إضافة مباراة" : "Ajouter un match"}
                    </button>
                  )}

                  {/* Round Matches List */}
                  <div className="flex flex-col justify-around flex-1 space-y-4">
                    {round.matches.map((m) => {
                      const isFinal = round.roundKey === "FINAL";
                      const isHomeWinner = m.winner === "HOME";
                      const isAwayWinner = m.winner === "AWAY";
                      const hasWinner = isHomeWinner || isAwayWinner;
                      const involvesOurClub = m.homeTeam.isOurClub || m.awayTeam.isOurClub;
                      const scoresTied = m.homeTeam.score != null && m.homeTeam.score === m.awayTeam.score;

                      return (
                        <div
                          key={m.id}
                          className={`group relative rounded-xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
                            isFinal
                              ? "border-amber-400/70 bg-gradient-to-b from-amber-500/[0.06] via-card to-card ring-1 ring-amber-400/20"
                              : involvesOurClub
                              ? "border-s-4 border-s-club-primary border-t-border/80 border-b-border/80 border-e-border/80 bg-card"
                              : "border-border/80 bg-card hover:border-border"
                          }`}
                        >
                          {/* Match Top Bar: Date & Status */}
                          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-muted/20 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1 font-medium">
                              <Calendar className="h-3 w-3 text-muted-foreground/70" />
                              <span>{m.date || (isAr ? "محدد لاحقاً" : "À déterminer")}</span>
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 font-bold text-[10px] uppercase tracking-wide ${
                                m.status === "FINISHED"
                                  ? "bg-muted text-foreground/80 border border-border/50"
                                  : m.status === "LIVE"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-pulse"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              }`}
                            >
                              {m.status === "FINISHED"
                                ? isAr ? "انتهت" : "Terminé"
                                : m.status === "LIVE"
                                ? isAr ? "مباشر" : "En direct"
                                : isAr ? "مبرمجة" : "Programmé"}
                            </span>
                          </div>

                          {/* Teams Container */}
                          <div className="p-2 space-y-1">
                            {/* Team 1 (Home) Row */}
                            <div
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all ${
                                isHomeWinner
                                  ? "bg-emerald-500/10 font-bold text-foreground ring-1 ring-emerald-500/20"
                                  : hasWinner && !isHomeWinner
                                  ? "opacity-65 text-muted-foreground bg-transparent"
                                  : "bg-muted/15 text-foreground hover:bg-muted/30"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-6 w-6 shrink-0 rounded-md overflow-hidden border border-border/70 bg-background flex items-center justify-center shadow-2xs">
                                  {m.homeTeam.logo ? (
                                    <img src={m.homeTeam.logo} alt="" className="h-full w-full object-contain p-0.5" />
                                  ) : (
                                    <Shield className={`h-3.5 w-3.5 ${m.homeTeam.isOurClub ? "text-club-primary" : "text-muted-foreground"}`} />
                                  )}
                                </div>

                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={m.homeTeam.name}
                                    onChange={(e) => handleTeamNameChange(round.roundKey, m.id, "home", e.target.value)}
                                    className="w-28 rounded border border-border bg-background p-1 text-xs"
                                  />
                                ) : (
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-xs truncate font-semibold">
                                      {m.homeTeam.name}
                                    </span>
                                    {m.homeTeam.isOurClub && (
                                      <span className="inline-flex items-center gap-0.5 rounded bg-club-primary px-1.5 py-0.2 text-[9px] font-black text-white shrink-0 shadow-2xs">
                                        <Sparkles className="h-2 w-2" />
                                        <span>{isAr ? "نحن" : "Notre Club"}</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isHomeWinner && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                )}
                                {isEditing ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={m.homeTeam.score ?? ""}
                                    onChange={(e) => handleScoreChange(round.roundKey, m.id, "home", e.target.value)}
                                    className="w-9 text-center rounded border border-border bg-background p-1 text-xs font-bold"
                                  />
                                ) : (
                                  <span
                                    className={`w-6 h-6 flex items-center justify-center rounded-md font-mono text-xs font-black transition-all ${
                                      isHomeWinner
                                        ? "bg-emerald-600 text-white shadow-2xs"
                                        : m.homeTeam.score !== null && m.homeTeam.score !== undefined
                                        ? "bg-background border border-border text-foreground font-bold"
                                        : "bg-muted/40 text-muted-foreground/50 border border-dashed border-border/70"
                                    }`}
                                  >
                                    {m.homeTeam.score !== null && m.homeTeam.score !== undefined ? m.homeTeam.score : "—"}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Divider with subtle VS or Trophy (in final) */}
                            {isFinal ? (
                              <div className="relative flex items-center justify-center my-0.5">
                                <div className="absolute inset-x-0 h-px bg-amber-400/20" />
                                <span className="relative rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-black text-amber-700 dark:text-amber-300 border border-amber-400/40 flex items-center gap-1">
                                  <Trophy className="h-2.5 w-2.5 text-amber-500" />
                                  <span>VS</span>
                                </span>
                              </div>
                            ) : (
                              <div className="h-px bg-border/40 mx-2" />
                            )}

                            {/* Team 2 (Away) Row */}
                            <div
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all ${
                                isAwayWinner
                                  ? "bg-emerald-500/10 font-bold text-foreground ring-1 ring-emerald-500/20"
                                  : hasWinner && !isAwayWinner
                                  ? "opacity-65 text-muted-foreground bg-transparent"
                                  : "bg-muted/15 text-foreground hover:bg-muted/30"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-6 w-6 shrink-0 rounded-md overflow-hidden border border-border/70 bg-background flex items-center justify-center shadow-2xs">
                                  {m.awayTeam.logo ? (
                                    <img src={m.awayTeam.logo} alt="" className="h-full w-full object-contain p-0.5" />
                                  ) : (
                                    <Shield className={`h-3.5 w-3.5 ${m.awayTeam.isOurClub ? "text-club-primary" : "text-muted-foreground"}`} />
                                  )}
                                </div>

                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={m.awayTeam.name}
                                    onChange={(e) => handleTeamNameChange(round.roundKey, m.id, "away", e.target.value)}
                                    className="w-28 rounded border border-border bg-background p-1 text-xs"
                                  />
                                ) : (
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-xs truncate font-semibold">
                                      {m.awayTeam.name}
                                    </span>
                                    {m.awayTeam.isOurClub && (
                                      <span className="inline-flex items-center gap-0.5 rounded bg-club-primary px-1.5 py-0.2 text-[9px] font-black text-white shrink-0 shadow-2xs">
                                        <Sparkles className="h-2 w-2" />
                                        <span>{isAr ? "نحن" : "Notre Club"}</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isAwayWinner && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                )}
                                {isEditing ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={m.awayTeam.score ?? ""}
                                    onChange={(e) => handleScoreChange(round.roundKey, m.id, "away", e.target.value)}
                                    className="w-9 text-center rounded border border-border bg-background p-1 text-xs font-bold"
                                  />
                                ) : (
                                  <span
                                    className={`w-6 h-6 flex items-center justify-center rounded-md font-mono text-xs font-black transition-all ${
                                      isAwayWinner
                                        ? "bg-emerald-600 text-white shadow-2xs"
                                        : m.awayTeam.score !== null && m.awayTeam.score !== undefined
                                        ? "bg-background border border-border text-foreground font-bold"
                                        : "bg-muted/40 text-muted-foreground/50 border border-dashed border-border/70"
                                    }`}
                                  >
                                    {m.awayTeam.score !== null && m.awayTeam.score !== undefined ? m.awayTeam.score : "—"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Admin Winner Selector */}
                          {isEditing && (
                            <div className="px-3 py-2 bg-muted/30 border-t border-border space-y-2 text-[11px]">
                              {scoresTied && (
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-muted-foreground">{isAr ? "ركلات الترجيح:" : "Tirs au but :"}</span>
                                  <input aria-label={isAr ? "ركلات ترجيح المضيف" : "Tirs au but domicile"} type="number" min="0" value={m.homeTeam.penalties ?? ""} onChange={(e) => handlePenaltyChange(round.roundKey, m.id, "home", e.target.value)} className="w-12 rounded border border-border bg-background px-1 py-0.5 text-center" />
                                  <span>:</span>
                                  <input aria-label={isAr ? "ركلات ترجيح الضيف" : "Tirs au but extérieur"} type="number" min="0" value={m.awayTeam.penalties ?? ""} onChange={(e) => handlePenaltyChange(round.roundKey, m.id, "away", e.target.value)} className="w-12 rounded border border-border bg-background px-1 py-0.5 text-center" />
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground font-medium">{isAr ? "الفائز المتأهل:" : "Vainqueur :"}</span>
                                <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={!isHomeWinner && (m.homeTeam.score == null || m.awayTeam.score == null || (scoresTied && (m.homeTeam.penalties == null || m.awayTeam.penalties == null || m.homeTeam.penalties <= m.awayTeam.penalties)) || (!scoresTied && m.homeTeam.score <= m.awayTeam.score))}
                                  onClick={() => handleWinnerChange(round.roundKey, m.id, isHomeWinner ? null : "HOME")}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                    isHomeWinner ? "bg-emerald-600 text-white shadow-2xs" : "bg-card border border-border hover:bg-muted text-foreground"
                                  }`}
                                >
                                  {m.homeTeam.name ? m.homeTeam.name.slice(0, 10) : (isAr ? "المضيف" : "Équipe 1")}
                                </button>
                                <button
                                  type="button"
                                  disabled={!isAwayWinner && (m.homeTeam.score == null || m.awayTeam.score == null || (scoresTied && (m.homeTeam.penalties == null || m.awayTeam.penalties == null || m.awayTeam.penalties <= m.homeTeam.penalties)) || (!scoresTied && m.awayTeam.score <= m.homeTeam.score))}
                                  onClick={() => handleWinnerChange(round.roundKey, m.id, isAwayWinner ? null : "AWAY")}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                    isAwayWinner ? "bg-emerald-600 text-white shadow-2xs" : "bg-card border border-border hover:bg-muted text-foreground"
                                  }`}
                                >
                                  {m.awayTeam.name ? m.awayTeam.name.slice(0, 10) : (isAr ? "الضيف" : "Équipe 2")}
                                </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {m.notes && !isFinal && (
                            <div className="px-3 pb-2 text-[10px] text-muted-foreground text-center italic">
                              {m.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
