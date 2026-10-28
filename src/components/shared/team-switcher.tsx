"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { setCurrentTeamAction } from "@/lib/actions/team-switcher";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";

type TeamOption = { id: string; label: string };

export function TeamSwitcher({
  locale,
  currentTeamId,
  teams,
  allTeamsLabel
}: {
  locale: string;
  currentTeamId: string | null;
  teams: TeamOption[];
  allTeamsLabel?: string | null;
}) {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const teamInputRef = useRef<HTMLInputElement>(null);

  // When a restricted user has only 1 team and no "ALL" option, or 0 teams,
  // switching is disabled in the UI. Server-side validation will also reject any
  // direct modification attempt (Invariant B, Invariant D).
  const isLocked = teams.length <= 1 && !allTeamsLabel;

  // Pages where team/category switching is irrelevant or handled in-page (matches, training, club-wide, administrative, finance, inventory, governance, audit, calendar, mail):
  const isClubWidePage =
    pathname.endsWith("/dashboard") ||
    pathname.endsWith("/dashboard/announcements/new") ||
    pathname.includes("/dashboard/mail") ||
    pathname.includes("/dashboard/training") ||
    pathname.includes("/dashboard/testing") ||
    pathname.includes("/dashboard/competitions") ||
    pathname.includes("/dashboard/matches") ||
    pathname.includes("/dashboard/players") ||
    pathname.includes("/dashboard/insurance") ||
    pathname.includes("/dashboard/medical-records") ||
    pathname.includes("/dashboard/finance") ||
    pathname.includes("/dashboard/users") ||
    pathname.includes("/dashboard/roles") ||
    pathname.includes("/dashboard/audit-logs") ||
    pathname.includes("/dashboard/settings") ||
    pathname.includes("/dashboard/inventory") ||
    pathname.includes("/dashboard/calendar") ||
    pathname.includes("/dashboard/notifications") ||
    pathname.includes("/dashboard/reports") ||
    pathname.includes("/dashboard/website") ||
    pathname.includes("/dashboard/teams") ||
    pathname.includes("/dashboard/contracts") ||
    pathname.includes("/dashboard/tactics") ||
    pathname.includes("/dashboard/gallery") ||
    pathname.includes("/dashboard/meeting-minutes") ||
    pathname.includes("/dashboard/jobs");

  if (isClubWidePage) {
    return null;
  }

  return (
    <form ref={formRef} action={setCurrentTeamAction} className="flex items-center gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnTo" value={pathname} />
      <input
        ref={teamInputRef}
        type="hidden"
        name="teamId"
        value={currentTeamId ?? (allTeamsLabel ? "ALL" : (teams[0]?.id ?? ""))}
        readOnly
      />
      <MasterFilterSelect
        label={locale === "ar" ? "الفئة:" : "Catégorie :"}
        locale={locale === "ar" ? "ar" : "fr"}
        value={currentTeamId ?? (allTeamsLabel ? "ALL" : (teams[0]?.id ?? ""))}
        hideIcon
        options={[
          ...(allTeamsLabel ? [{ id: "ALL", label: allTeamsLabel }] : []),
          ...teams,
        ]}
        onChange={(teamId) => {
          if (teamInputRef.current) teamInputRef.current.value = teamId;
          formRef.current?.requestSubmit();
        }}
        disabled={isLocked}
      />
    </form>
  );
}
