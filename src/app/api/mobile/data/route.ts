import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNativePrincipal } from "@/lib/native-session";
import { hasPermission } from "@/lib/permissions";
import { resolveTeamScope } from "@/lib/authz/policy";
import { getMatchDisplayNames } from "@/lib/matches/team-names";
import { frenchCompetitionName } from "@/lib/public/locale-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "ar";
  const summary = new URL(request.url).searchParams.get("summary") === "1";
  const scope = await resolveTeamScope(db, user);
  const teamWhere = scope.restricted ? { teamId: { in: [...scope.teamIds] } } : {};
  const meetingScopeWhere = scope.restricted ? { OR: [{ teamId: { in: [...scope.teamIds] } }, { teamId: null }] } : {};
  const canViewMatches = hasPermission(user, "matches.view");
  const canUpdateMatches = hasPermission(user, "matches.update");
  const canReportMatches = hasPermission(user, "matches.report");
  const canScheduleMeetings = hasPermission(user, "meetings.schedule");
  const canViewMeetings = hasPermission(user, "meetings.view") || canScheduleMeetings;
  const canManageMeetings = hasPermission(user, "meetings.manage");
  const canManageCalendar = hasPermission(user, "calendar.manage");
  const canManageTraining = hasPermission(user, "training.manage");
  const canCreateNews = hasPermission(user, "news.create");
  const canManageAnnouncements = hasPermission(user, "announcements.manage");

  const [matches, meetings, calendarMeetings, notifications, teams, coaches] = await Promise.all([
    canViewMatches ? db.match.findMany({
      where: teamWhere,
      include: {
        competition: { select: { name: true } },
        team: { select: { id: true, name: true, category: true, players: { where: { status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], ...(summary ? { take: 0 } : {}), select: { id: true, firstName: true, lastName: true, firstNameFr: true, lastNameFr: true, shirtNumber: true } } } },
        lineups: { ...(summary ? { take: 0 } : {}), include: { player: { select: { id: true, firstName: true, lastName: true, firstNameFr: true, lastNameFr: true, shirtNumber: true } } } },
        events: {
          orderBy: [{ minute: "asc" }, { id: "asc" }], take: summary ? 0 : 100,
          select: { id: true, type: true, minute: true, side: true, source: true, playerName: true, playerNameFr: true, player: { select: { firstName: true, lastName: true, firstNameFr: true, lastNameFr: true } }, shot: { select: { xG: true, bodyPart: true } } }
        },
        shots: { ...(summary ? { take: 0 } : {}), orderBy: { minute: "asc" }, select: { id: true, side: true, minute: true, outcome: true, xG: true, playerId: true } }
      },
      orderBy: { matchDate: "desc" },
      take: summary ? 3 : 50
    }) : Promise.resolve([]),
    canViewMeetings ? db.meetingMinute.findMany({
      where: teamWhere,
      include: { team: { select: { name: true } }, responsiblePerson: { select: { name: true } } },
      orderBy: { date: "desc" }, take: 50
    }) : Promise.resolve([]),
    (canViewMeetings || canManageCalendar) ? db.calendarEvent.findMany({
      where: { ...meetingScopeWhere, type: "MEETING", endDateTime: { gte: new Date() } },
      include: { team: { select: { name: true } }, meetingMinute: { select: { id: true } } }, orderBy: { startDateTime: "asc" }, take: 25
    }) : Promise.resolve([]),
    db.notification.findMany({ where: { userId: user.id, type: "UPCOMING_MATCH" }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, type: true, title: true, message: true, link: true, isRead: true, createdAt: true } }),
    (canManageTraining || canManageAnnouncements || canScheduleMeetings) ? db.team.findMany({ where: scope.restricted ? { id: { in: [...scope.teamIds] } } : {}, orderBy: { name: "asc" }, select: { id: true, name: true, category: true } }) : Promise.resolve([]),
    canManageTraining ? db.staff.findMany({
      where: {
        status: "ACTIVE",
        role: { in: ["HEAD_COACH", "ASSISTANT_COACH", "GOALKEEPING_COACH", "FITNESS_COACH"] },
        ...(scope.restricted ? { OR: [
          { teamId: { in: [...scope.teamIds] } },
          { teamAssignments: { some: { teamId: { in: [...scope.teamIds] } } } }
        ] } : {})
      },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, firstNameFr: true, lastNameFr: true, teamId: true, teamAssignments: { select: { teamId: true } } }
    }) : Promise.resolve([])
  ]);

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, image: user.image, licenseNumber: user.licenseNumber, roleKey: user.roleKey, roleName: user.roleName },
    permissions: { matches: canViewMatches, updateMatches: canUpdateMatches, reportMatches: canReportMatches, meetings: canViewMeetings, manageMeetings: canManageMeetings, scheduleMeetings: canScheduleMeetings, calendar: canManageCalendar, training: canManageTraining, news: canCreateNews, announcements: canManageAnnouncements, teamScopeRestricted: scope.restricted },
    teams,
    coaches: coaches.map((coach) => ({
      id: coach.id,
      name: locale === "fr"
        ? [coach.firstNameFr, coach.lastNameFr].filter(Boolean).join(" ").trim() || `${coach.firstName} ${coach.lastName}`.trim()
        : `${coach.firstName} ${coach.lastName}`.trim(),
      teamIds: [...new Set([coach.teamId, ...coach.teamAssignments.map((assignment) => assignment.teamId)].filter((id): id is string => Boolean(id)))].filter((teamId) => !scope.restricted || scope.teamIds.includes(teamId))
    })),
    matches: matches.map((match) => {
      const names = getMatchDisplayNames(match, locale);
      return {
        id: match.id,
        date: match.matchDate,
        status: match.status,
        opponent: match.isHomeFixture ? names.awayTeamName : names.homeTeamName,
        homeTeamName: names.homeTeamName,
        awayTeamName: names.awayTeamName,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        clubScore: match.isHomeFixture ? match.homeScore : match.awayScore,
        opponentScore: match.isHomeFixture ? match.awayScore : match.homeScore,
        isHomeFixture: match.isHomeFixture,
        competition: locale === "fr" ? frenchCompetitionName(match.competition.name) : match.competition.name,
        team: match.team?.name ?? null,
        players: [...new Map([
          ...(canReportMatches ? (match.team?.players ?? []) : []),
          ...match.lineups.map(({ player, shirtNumber }) => ({ ...player, shirtNumber: shirtNumber ?? player.shirtNumber }))
        ].map((player) => [player.id, player])).values()].map((player) => {
          const arabicName = `${player.firstName} ${player.lastName}`.trim();
          const frenchName = [player.firstNameFr, player.lastNameFr].filter(Boolean).join(" ").trim();
          return { id: player.id, name: locale === "fr" ? frenchName || arabicName : arabicName, nameFr: frenchName, number: player.shirtNumber };
        }),
        events: match.events.map((event) => ({
          id: event.id, type: event.type, minute: event.minute, side: event.side, source: event.source,
          xG: event.shot?.xG ?? null,
          playerName: event.player ? (locale === "fr" ? [event.player.firstNameFr, event.player.lastNameFr].filter(Boolean).join(" ").trim() || `${event.player.firstName} ${event.player.lastName}` : `${event.player.firstName} ${event.player.lastName}`) : (locale === "fr" ? event.playerNameFr || event.playerName : event.playerName),
          playerNameFr: event.player ? [event.player.firstNameFr, event.player.lastNameFr].filter(Boolean).join(" ").trim() : event.playerNameFr
        })),
        canUpdate: canUpdateMatches,
        canReport: canReportMatches,
        stats: {
          shotsFor: match.shots.filter((shot) => shot.side === (match.isHomeFixture ? "HOME" : "AWAY")).length,
          shotsAgainst: match.shots.filter((shot) => shot.side !== (match.isHomeFixture ? "HOME" : "AWAY")).length,
          xgFor: match.shots.filter((shot) => shot.side === (match.isHomeFixture ? "HOME" : "AWAY")).reduce((sum, shot) => sum + (shot.xG ?? 0), 0),
          xgAgainst: match.shots.filter((shot) => shot.side !== (match.isHomeFixture ? "HOME" : "AWAY")).reduce((sum, shot) => sum + (shot.xG ?? 0), 0),
          yellowCardsFor: match.events.filter((event) => event.type === "YELLOW_CARD" && event.side === (match.isHomeFixture ? "HOME" : "AWAY")).length,
          redCardsFor: match.events.filter((event) => event.type === "RED_CARD" && event.side === (match.isHomeFixture ? "HOME" : "AWAY")).length
        }
      };
    }),
    meetings: meetings.map((meeting) => ({
      id: meeting.id, title: meeting.title, date: meeting.date, location: meeting.location,
      attendees: meeting.attendees, agenda: meeting.agenda, decisions: meeting.decisions,
      status: meeting.status, team: meeting.team?.name ?? null, responsiblePerson: meeting.responsiblePerson.name,
      canManage: canManageMeetings
    })),
    upcomingMeetings: calendarMeetings.map((event) => ({
      id: event.id, title: event.title, date: event.startDateTime, endDate: event.endDateTime,
      location: event.location, team: event.team?.name ?? null, hasMinutes: Boolean(event.meetingMinute),
      canManage: canManageMeetings || canManageCalendar || canScheduleMeetings
    })),
    notifications
  }, { headers: { "Cache-Control": "no-store" } });
}
