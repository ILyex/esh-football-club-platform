"use client";

import { useEffect, useMemo, useState } from "react";
import { UsersRound } from "lucide-react";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";

interface Option { id: string; label: string; }

export function TrainingTeamCoachFields({
  teams,
  coaches,
  initialTeamId,
  locale,
  teamLabel,
  coachLabel,
  teamPlaceholder,
  coachPlaceholder,
  teamHeader,
  coachHeader
}: {
  teams: Option[];
  coaches: (Option & { teamIds: string[] })[];
  initialTeamId: string;
  locale: string;
  teamLabel: string;
  coachLabel: string;
  teamPlaceholder: string;
  coachPlaceholder: string;
  teamHeader: string;
  coachHeader: string;
}) {
  const [teamId, setTeamId] = useState(initialTeamId);
  useEffect(() => setTeamId(initialTeamId), [initialTeamId]);
  const filteredCoaches = useMemo(
    () => teamId ? coaches.filter((coach) => coach.teamIds.includes(teamId)) : coaches,
    [coaches, teamId]
  );

  return (
    <>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="h-4 w-4 shrink-0 text-club-primary" />{teamLabel}</label>
        <MasterFilterSelect
          name="teamId"
          value={teamId}
          options={teams}
          onChange={setTeamId}
          locale={locale === "ar" ? "ar" : "fr"}
          placeholder={teamPlaceholder}
          headerTitle={teamHeader}
          className="w-full [&>button]:h-10 [&>button]:w-full [&>button]:justify-between [&>button]:bg-background [&>button]:shadow-2xs"
        />
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="h-4 w-4 shrink-0 text-club-primary" />{coachLabel}</label>
        <MasterFilterSelect
          key={`coach-${teamId}`}
          name="coachId"
          value=""
          options={filteredCoaches}
          locale={locale === "ar" ? "ar" : "fr"}
          placeholder={coachPlaceholder}
          headerTitle={coachHeader}
          className="w-full [&>button]:h-10 [&>button]:w-full [&>button]:justify-between [&>button]:bg-background [&>button]:shadow-2xs"
        />
      </div>
    </>
  );
}
