"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Activity,
  Award,
  CircleDot,
  CircleX,
  Flame,
  ExternalLink,
  Target,
  Zap,
  X
} from "lucide-react";

import { getPlayerDisplayName } from "@/lib/utils";
import { localizedNationality } from "@/lib/public/locale-text";
import { OfficialPlayerAttestationModal } from "./official-player-attestation-modal";
import { SafeImage } from "@/components/shared/safe-image";

export interface SerializedPlayerOverview {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  firstNameFr?: string | null;
  lastNameFr?: string | null;
  shirtNumber: number | null;
  position: string;
  nationality: string;
  licenceNumber?: string | null;
  dateOfBirth: string;
  height: number | null;
  weight: number | null;
  preferredFoot: string | null;
  status: string;
  photoUrl: string | null;
  joiningDate: string | null;
  team: {
    id: string;
    name: string;
    category: string;
  } | null;
  isInsured?: boolean;
  stats: {
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    appearances: number;
  };
  attendance: {
    total: number;
    present: number;
    absent: number;
    excused: number;
    injured: number;
    rate: number;
  };
  recentMatchEvents: Array<{
    id: string;
    type: string;
    minute: number;
    notes: string | null;
    match: {
      id: string;
      opponent: string;
      date: string;
      competitionName: string;
    };
  }>;
  recentAttendances: Array<{
    trainingId: string;
    status: string;
    date: string;
  }>;
}

const POSITION_LABELS: Record<string, { ar: string; fr: string }> = {
  GOALKEEPER: { ar: "حارس مرمى", fr: "Gardien" },
  DEFENDER: { ar: "مدافع", fr: "Défenseur" },
  MIDFIELDER: { ar: "وسط ميدان", fr: "Milieu" },
  FORWARD: { ar: "مهاجم", fr: "Attaquant" }
};

const CATEGORY_LABELS: Record<string, { ar: string; fr: string }> = {
  SENIOR: { ar: "أكابر", fr: "Sénior" },
  U20: { ar: "أقل من 20 سنة (U20)", fr: "U20" },
  U17: { ar: "أقل من 17 سنة (U17)", fr: "U17" },
  U15: { ar: "أقل من 15 سنة (U15)", fr: "U15" }
};

const STATUS_LABELS: Record<string, { ar: string; fr: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  ACTIVE: { ar: "نشط ومعتمد", fr: "Actif et homologué", tone: "success" },
  INJURED: { ar: "مصاب", fr: "Blessé", tone: "warning" },
  SUSPENDED: { ar: "معاقب", fr: "Suspendu", tone: "danger" },
  ON_LOAN: { ar: "معار", fr: "Prêté", tone: "neutral" },
  ARCHIVED: { ar: "مؤرشف", fr: "Archivé", tone: "neutral" }
};

export function PlayerOverviewModal({
  player,
  locale
}: {
  player: SerializedPlayerOverview;
  locale: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isAr = locale === "ar";

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const posLabel = POSITION_LABELS[player.position]?.[isAr ? "ar" : "fr"] || player.position;
  const catLabel = player.team?.category
    ? CATEGORY_LABELS[player.team.category]?.[isAr ? "ar" : "fr"] || player.team.name
    : isAr ? "غير محدد" : "Non assigné";
  const statusInfo = STATUS_LABELS[player.status] || {
    ar: "غير محدد",
    fr: "Non renseigné",
    tone: "neutral" as const
  };

  const age = Math.floor(
    (new Date().getTime() - new Date(player.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-club-primary hover:bg-club-primary/10 transition-colors"
      >
        <Activity className="h-3 w-3" />
        <span>{isAr ? "عرض" : "Voir"}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Container */}
          <div
            dir={isAr ? "rtl" : "ltr"}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl z-10 animate-in zoom-in-95"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 start-4 z-20 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header Hero Banner */}
            <div className="relative overflow-hidden bg-gradient-to-br from-club-primary/95 via-club-primary to-rose-900 p-6 text-white">
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/20 bg-black/20 shadow-lg">
                    {player.photoUrl ? (
                      <SafeImage
                        src={player.photoUrl}
                        fallbackSrc="/branding/person-placeholder.svg"
                        alt={`${player.firstName} ${player.lastName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-black text-white/90 uppercase">
                        {(player.firstName[0] || "") + (player.lastName[0] || "")}
                      </span>
                    )}
                    {player.shirtNumber !== null && (
                      <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 font-mono text-xs font-black text-black shadow-xs">
                        {player.shirtNumber}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">
                        {getPlayerDisplayName(player, locale)}
                      </h2>
                      <Badge tone={statusInfo.tone} className="text-[10px] bg-white/20 text-white border-white/30">
                        {statusInfo[isAr ? "ar" : "fr"]}
                      </Badge>
                      {player.isInsured ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span>{isAr ? "مؤمَّن عليه" : "Assuré"}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 border border-red-400/40 px-2 py-0.5 text-[10px] font-bold text-red-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                          <span>{isAr ? "بدون تأمين" : "Non assuré"}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/80 mt-0.5">
                      {posLabel} • {catLabel} • {localizedNationality(player.nationality, locale)}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-white/70 mt-1">
                      <span>{age} {isAr ? "سنة" : "ans"}</span>
                      {player.height && <span>{player.height} cm</span>}
                      {player.weight && <span>{player.weight} kg</span>}
                      {player.preferredFoot && (
                        <span>{isAr ? "القدم:" : "Pied:"} {player.preferredFoot === "LEFT" ? (isAr ? "يسرى" : "Gauche") : (isAr ? "يمنى" : "Droit")}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <OfficialPlayerAttestationModal
                    player={{
                      id: player.id,
                      firstName: player.firstName,
                      lastName: player.lastName,
                      firstNameFr: player.firstNameFr,
                      lastNameFr: player.lastNameFr,
                      dateOfBirth: new Date(player.dateOfBirth),
                      nationality: player.nationality,
                      licenceNumber: player.licenceNumber,
                      joiningDate: player.joiningDate ? new Date(player.joiningDate) : null,
                      position: posLabel,
                      shirtNumber: player.shirtNumber,
                      teamName: player.team?.name,
                      teamCategory: catLabel,
                      photoUrl: player.photoUrl
                    }}
                    locale={locale}
                    triggerVariant="outline"
                    triggerLabel={isAr ? "وثيقة اللاعب" : "Attestation"}
                    triggerClassName="h-9 min-w-[8.5rem] rounded-lg border-white/25 bg-white/10 px-3 text-white shadow-sm hover:border-white/40 hover:bg-white/20"
                  />
                  <Link
                    href={`/${locale}/dashboard/players/${player.id}`}
                    onClick={() => setIsOpen(false)}
                    className="inline-flex h-9 min-w-[8.5rem] items-center justify-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:border-white/40 hover:bg-white/20"
                  >
                    <span>{isAr ? "الملف الكامل والتعديل" : "Modifier"}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* 1. Official Match Stats Grid (from Referee Reports) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-club-primary" />
                    <span>{isAr ? "سجل المباريات والأداء (من تقارير الحكام)" : "Statistiques officielles (issues des rapports d’arbitrage)"}</span>
                  </h3>
                  <span className="text-[11px] font-mono font-semibold text-muted-foreground">
                    {player.stats.appearances} {isAr ? "مباراة رسمية" : "matchs"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Goals */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                    <Target className="h-5 w-5 mx-auto text-emerald-600 dark:text-emerald-400" />
                    <span className="block font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {player.stats.goals}
                    </span>
                    <span className="text-[11px] font-semibold text-foreground">
                      {isAr ? "أهداف مسجلة" : "Buts"}
                    </span>
                  </div>

                  {/* Assists */}
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-center">
                    <Zap className="h-5 w-5 mx-auto text-blue-600 dark:text-blue-400" />
                    <span className="block font-mono text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                      {player.stats.assists}
                    </span>
                    <span className="text-[11px] font-semibold text-foreground">
                      {isAr ? "تمريرات حاسمة" : "Passes D."}
                    </span>
                  </div>

                  {/* Yellow Cards */}
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                    <span className="inline-block w-3.5 h-4.5 rounded-xs bg-amber-400 border border-amber-500 shadow-2xs mx-auto" />
                    <span className="block font-mono text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                      {player.stats.yellowCards}
                    </span>
                    <span className="text-[11px] font-semibold text-foreground">
                      {isAr ? "بطاقات صفراء" : "Cartons jaunes"}
                    </span>
                  </div>

                  {/* Red Cards */}
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
                    <span className="inline-block w-3.5 h-4.5 rounded-xs bg-red-500 border border-red-600 shadow-2xs mx-auto" />
                    <span className="block font-mono text-2xl font-black text-red-600 dark:text-red-400 mt-1">
                      {player.stats.redCards}
                    </span>
                    <span className="text-[11px] font-semibold text-foreground">
                      {isAr ? "بطاقات حمراء" : "Cartons rouges"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Training Attendance Section */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{isAr ? "سجل الحضور والغياب في الحصص التدريبية" : "Assiduité aux entraînements"}</span>
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {player.attendance.rate}% {isAr ? "نسبة الحضور" : "présence"}
                  </span>
                </div>

                {/* Attendance Progress Track */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, player.attendance.rate))}%` }}
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
                  <div className="rounded-lg bg-card p-2 border border-border/60">
                    <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400 block">
                      {player.attendance.present}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{isAr ? "حضور" : "Présents"}</span>
                  </div>
                  <div className="rounded-lg bg-card p-2 border border-border/60">
                    <span className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400 block">
                      {player.attendance.absent}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{isAr ? "غياب غير مبرر" : "Absents"}</span>
                  </div>
                  <div className="rounded-lg bg-card p-2 border border-border/60">
                    <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400 block">
                      {player.attendance.excused}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{isAr ? "غياب مبرر" : "Excusés"}</span>
                  </div>
                  <div className="rounded-lg bg-card p-2 border border-border/60">
                    <span className="font-mono text-sm font-bold text-purple-600 dark:text-purple-400 block">
                      {player.attendance.injured}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{isAr ? "إصابة" : "Blessés"}</span>
                  </div>
                </div>
              </div>

              {/* 3. Match Events Log (Goals & Cards Recorded in Referee Reports) */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  <span>{isAr ? "تفاصيل الأحداث الرسمية المسجلة للاعب" : "Événements officiels enregistrés"}</span>
                </h3>

                {player.recentMatchEvents.length > 0 ? (
                  <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                    {player.recentMatchEvents.map((evt) => {
                      const isGoal = evt.type === "GOAL" || evt.type === "PENALTY_GOAL";
                      const isMissedPenalty = evt.type === "PENALTY_MISSED";
                      const isYellow = evt.type === "YELLOW_CARD";
                      const isRed = evt.type === "RED_CARD";
                      const isAssist = evt.type === "ASSIST";

                      const badgeLabel = evt.type === "PENALTY_GOAL"
                        ? isAr ? `هدف من ركلة جزاء (دقيقة ${evt.minute}')` : `Penalty marqué (${evt.minute}')`
                        : isMissedPenalty
                        ? isAr ? `ركلة جزاء ضائعة (دقيقة ${evt.minute}')` : `Penalty manqué (${evt.minute}')`
                        : isGoal
                        ? isAr ? `هدف (دقيقة ${evt.minute}')` : `But (${evt.minute}')`
                        : isYellow
                        ? isAr ? `بطاقة صفراء (دقيقة ${evt.minute}')` : `Carton jaune (${evt.minute}')`
                        : isRed
                        ? isAr ? `بطاقة حمراء (دقيقة ${evt.minute}')` : `Carton rouge (${evt.minute}')`
                        : isAssist
                        ? isAr ? `تمريرة حاسمة (دقيقة ${evt.minute}')` : `Passe décisive (${evt.minute}')`
                        : `${evt.type} (${evt.minute}')`;

                      return (
                        <div key={evt.id} className="p-3 flex items-center justify-between text-xs hover:bg-muted/20">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                {evt.match.opponent}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                ({evt.match.competitionName})
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {evt.match.date} {evt.notes ? `• ${evt.notes}` : ""}
                            </p>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold font-mono ${
                              isMissedPenalty
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                : isGoal
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : isYellow
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : isRed
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {evt.type === "PENALTY_GOAL" && <CircleDot className="h-3 w-3 shrink-0" />}
                            {evt.type === "GOAL" && <Target className="h-3 w-3 shrink-0" />}
                            {isMissedPenalty && <CircleX className="h-3 w-3 shrink-0" />}
                            {isYellow && <span className="inline-block w-2.5 h-3.5 rounded-2xs bg-amber-400 border border-amber-500 shadow-2xs shrink-0" />}
                            {isRed && <span className="inline-block w-2.5 h-3.5 rounded-2xs bg-red-500 border border-red-600 shadow-2xs shrink-0" />}
                            {isAssist && <Zap className="h-3 w-3 shrink-0" />}
                            <span>{badgeLabel}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-4 text-center text-xs text-muted-foreground">
                    {isAr ? "لم تسجل أهداف أو بطاقات للاعب في تقارير الحكام حتى الآن." : "Aucun événement officiel enregistré pour ce joueur."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
