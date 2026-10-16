import "server-only";

import { Prisma, TeamCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { normalizeOpponentName } from "@/lib/opponents";
import { getFAFConfig } from "./config";
import { getFafEmsClient } from "./ems-client";

type RemoteMatch = Record<string, any>;
type LocalTeam = { id: string; category: TeamCategory; active: boolean };
type LocalCompetition = { id: string; name: string; teamId: string | null };

export type FafScheduledImportResult = {
  scanned: number;
  created: number;
  alreadyPresent: number;
  skipped: number;
  warnings: string[];
};

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["nomAr", "nameAr", "nomCompetition", "nomStade", "nom", "name", "libelle", "label", "denomination", "surnomAr", "surnom"]) {
      const result = record[key];
      if (typeof result === "string" && result.trim()) return result.trim();
    }
  }
  return "";
}

function normalize(value: string): string {
  return normalizeOpponentName(value).normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function namesMatch(left: string, right: string): boolean {
  const a = normalize(left);
  const b = normalize(right);
  return a.length >= 4 && b.length >= 4 && (a === b || a.includes(b) || b.includes(a));
}

function dateInAlgeria(value: unknown, timeValue: unknown): Date | null {
  const rawDate = String(value ?? "").trim();
  const rawTime = String(timeValue ?? "").trim();
  const iso = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  const dmy = rawDate.match(/^(\d{2})[/.](\d{2})[/.](\d{4})$/);
  let year: number, month: number, day: number, hour: number, minute: number, second: number;
  if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
    hour = Number(iso[4] ?? 0); minute = Number(iso[5] ?? 0); second = Number(iso[6] ?? 0);
    // If the EMS date already contains an explicit UTC offset, let Date parse it.
    if (iso[4] && /(?:Z|[+-]\d{2}:?\d{2})$/.test(rawDate)) {
      const parsed = new Date(rawDate);
      return Number.isNaN(parsed.valueOf()) ? null : parsed;
    }
  } else if (dmy) {
    if (!rawTime) return null;
    day = Number(dmy[1]); month = Number(dmy[2]); year = Number(dmy[3]);
    hour = 0; minute = 0; second = 0;
  } else {
    return null;
  }
  if (iso && !iso[4] && !rawTime) return null;
  if (rawTime) {
    const time = rawTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!time) return null;
    hour = Number(time[1]); minute = Number(time[2]); second = Number(time[3] ?? 0);
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  // Algeria is UTC+1 year-round. EMS returns local match date and kickoff time.
  const parsed = new Date(Date.UTC(year, month - 1, day, hour - 1, minute, second));
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return parsed;
}

function inferCategory(match: RemoteMatch, competitionName: string): TeamCategory | null {
  const categoryText = [
    text(match.category), text(match.categorie), text(match.categoryName), text(match.categorieName),
    text(match.categoryAge), text(match.groupe?.category), text(match.groupe?.categorie),
    text(match.competition?.category), text(match.competition?.categorie), competitionName
  ].filter(Boolean).join(" ").toLocaleLowerCase("ar");
  const compact = normalize(categoryText);
  if (/u20|moins20|moin20|under20|أقلمن20|اقلمن20|أكابر|اكابر|senior/.test(compact)) {
    if (/u20|moins20|moin20|under20|أقلمن20|اقلمن20/.test(compact)) return "U20";
    if (/senior|أكابر|اكابر/.test(compact)) return "SENIOR";
  }
  if (/u17|moins17|under17|أقلمن17|اقلمن17/.test(compact)) return "U17";
  if (/u15|moins15|under15|أقلمن15|اقلمن15/.test(compact)) return "U15";
  return null;
}

function clubCode(club: unknown): string {
  return String((club as Record<string, any> | null)?.fifaId ?? "").trim().toUpperCase();
}

function opponentName(club: unknown): string {
  return text(club);
}

function remoteCompetitionName(match: RemoteMatch): string {
  for (const value of [match.competition, match.competitionName, match.nomCompetition, match.championnat, match.epreuve]) {
    const label = text(value);
    if (label) return label;
  }
  return "";
}

function chooseCompetition(
  competitions: LocalCompetition[],
  team: LocalTeam,
  remoteName: string
): LocalCompetition | null {
  const allowed = competitions.filter((competition) => competition.teamId === team.id || competition.teamId === null);
  if (remoteName) {
    const matching = allowed.filter((competition) => namesMatch(competition.name, remoteName));
    if (matching.length === 1) return matching[0] ?? null;
    if (matching.length > 1) return null;
  }
  const teamSpecific = allowed.filter((competition) => competition.teamId === team.id);
  if (teamSpecific.length === 1) return teamSpecific[0] ?? null;
  if (teamSpecific.length > 1) return null;
  const clubWide = allowed.filter((competition) => competition.teamId === null);
  return clubWide.length === 1 ? clubWide[0] ?? null : null;
}

function algeriaDayBounds(date: Date): { start: Date; end: Date } {
  const local = new Date(date.getTime() + 60 * 60 * 1000);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 60 * 60 * 1000;
  return { start: new Date(start), end: new Date(start + 24 * 60 * 60 * 1000) };
}

function storedMatchId(value: string | undefined): string | null {
  try {
    const parsed = JSON.parse(value ?? "") as { matchId?: unknown };
    return typeof parsed.matchId === "string" ? parsed.matchId : null;
  } catch { return null; }
}

/** Imports the club's upcoming EMS schedule without touching existing manual
 * match edits. The EMS ID is a unique integration key; a date/team/opponent
 * match is linked to that key instead of being duplicated. */
export async function importUpcomingFafMatches(options: {
  actorId?: string | null;
  allowedTeamIds?: string[] | null;
  now?: Date;
  lookAheadDays?: number;
} = {}): Promise<FafScheduledImportResult> {
  const config = getFAFConfig();
  if (!config.enabled) throw new Error("FAF EMS integration is disabled on the server.");

  const now = options.now ?? new Date();
  const horizonDays = Math.min(30, Math.max(1, options.lookAheadDays ?? 14));
  const { start } = algeriaDayBounds(now);
  const { start: endDay } = algeriaDayBounds(new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000));
  const dateOnly = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const remoteMatches = await getFafEmsClient().scheduledMatches(dateOnly(start), dateOnly(endDay));
  const [teams, competitions] = await Promise.all([
    db.team.findMany({ where: { active: true }, select: { id: true, category: true, active: true } }),
    db.competition.findMany({ select: { id: true, name: true, teamId: true } })
  ]);
  const scopedTeams = teams.filter((team) => !options.allowedTeamIds || options.allowedTeamIds.includes(team.id));
  const byCategory = new Map(scopedTeams.map((team) => [team.category, team]));
  const currentClubCode = config.clubCode.toUpperCase();
  const candidates = remoteMatches.filter((match) => {
    const homeCode = clubCode(match.clubLoc);
    const awayCode = clubCode(match.clubVis);
    return homeCode === currentClubCode || awayCode === currentClubCode;
  });
  const result: FafScheduledImportResult = { scanned: candidates.length, created: 0, alreadyPresent: 0, skipped: 0, warnings: [] };
  const seenExternalIds = new Set<string>();

  for (const remote of candidates) {
    const externalId = String(remote.id ?? "").trim();
    const homeIsUs = clubCode(remote.clubLoc) === currentClubCode;
    const opponent = opponentName(homeIsUs ? remote.clubVis : remote.clubLoc);
    const kickoff = dateInAlgeria(remote.dateRencontre, remote.heureRencontre);
    const competitionName = remoteCompetitionName(remote);
    const category = inferCategory(remote, competitionName);
    const exactCompetitionMatches = competitionName
      ? competitions.filter((competition) => namesMatch(competition.name, competitionName))
      : [];
    const competitionTeam = exactCompetitionMatches.length === 1 && exactCompetitionMatches[0]?.teamId
      ? scopedTeams.find((candidate) => candidate.id === exactCompetitionMatches[0]?.teamId)
      : undefined;
    if (!externalId || seenExternalIds.has(externalId)) { result.alreadyPresent++; continue; }
    seenExternalIds.add(externalId);
    if (!opponent || !kickoff || kickoff < start) {
      result.skipped++;
      if (result.warnings.length < 5) result.warnings.push(`لم أستورد مباراة EMS رقم ${externalId}: بيانات الخصم أو موعد الانطلاق غير مكتملة.`);
      continue;
    }

    const team = category ? byCategory.get(category) : competitionTeam ?? null;
    if (!team) {
      result.skipped++;
      if (result.warnings.length < 5) result.warnings.push(`لم أستطع تحديد فئة المباراة ${externalId} بأمان${category ? ` (${category})` : ""}؛ لم أنشئ مباراة محتملة الخطأ.`);
      continue;
    }
    if (category && team.category !== category) {
      result.skipped++;
      if (result.warnings.length < 5) result.warnings.push(`فئة المسابقة في FAF EMS لا تطابق فئة المسابقة المحلية للمباراة ${externalId}؛ لم أنشئ المباراة.`);
      continue;
    }
    const competition = chooseCompetition(competitions, team, competitionName);
    if (!competition) {
      result.skipped++;
      if (result.warnings.length < 5) result.warnings.push(`لم أستطع مطابقة مسابقة FAF EMS «${competitionName || "بدون اسم"}» بفئة ${team.category} محليًا؛ لم أنشئ المباراة.`);
      continue;
    }

    const externalKey = `faf-ems-scheduled-match:${externalId}`;
    const clubName = "نادي أمل سيدي حسني";
    const homeTeamName = homeIsUs ? clubName : opponent;
    const awayTeamName = homeIsUs ? opponent : clubName;
    const stadium = text(remote.stade);
    try {
      const outcome = await db.$transaction(async (tx) => {
        const mapped = await tx.integrationState.findUnique({ where: { key: externalKey }, select: { value: true } });
        if (mapped) {
          const mappedId = storedMatchId(mapped.value);
          const mappedMatchExists = mappedId ? await tx.match.findUnique({ where: { id: mappedId }, select: { id: true } }) : null;
          if (mappedMatchExists) return "existing" as const;
          await tx.integrationState.delete({ where: { key: externalKey } });
        }

        const bounds = algeriaDayBounds(kickoff);
        const sameDayMatches = await tx.match.findMany({
          where: {
            teamId: team.id,
            competitionId: competition.id,
            matchDate: { gte: bounds.start, lt: bounds.end }
          },
          select: { id: true, homeTeamName: true, awayTeamName: true, isHomeFixture: true }
        });
        const existingManual = sameDayMatches.find((match) => {
          const existingOpponent = match.isHomeFixture ? match.awayTeamName : match.homeTeamName;
          return namesMatch(existingOpponent, opponent);
        });
        const matchId = existingManual?.id ?? (await tx.match.create({
          data: {
            competitionId: competition.id,
            teamId: team.id,
            homeTeamName,
            awayTeamName,
            isHomeFixture: homeIsUs,
            matchDate: kickoff,
            stadium: stadium || null,
            status: "SCHEDULED"
          },
          select: { id: true }
        })).id;

        if (!existingManual) {
          const title = `${homeTeamName} vs ${awayTeamName}`;
          await tx.calendarEvent.upsert({
            where: { relatedMatchId: matchId },
            update: { title, startDateTime: kickoff, endDateTime: new Date(kickoff.getTime() + 2 * 60 * 60 * 1000), teamId: team.id, location: stadium || null },
            create: { title, type: "MATCH", startDateTime: kickoff, endDateTime: new Date(kickoff.getTime() + 2 * 60 * 60 * 1000), teamId: team.id, location: stadium || null, relatedMatchId: matchId }
          });
          await writeAuditLog({ userId: options.actorId ?? null, action: "FAF_SCHEDULED_MATCH_IMPORTED", entityType: "Match", entityId: matchId, changes: { externalId, teamCategory: team.category, competitionId: competition.id } }, tx);
        }
        await tx.integrationState.create({ data: { key: externalKey, value: JSON.stringify({ matchId, externalId, syncedAt: new Date().toISOString(), source: existingManual ? "matched-manual" : "faf-ems" }) } });
        return existingManual ? "existing" as const : "created" as const;
      });
      if (outcome === "created") result.created++;
      else result.alreadyPresent++;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        result.alreadyPresent++;
      } else {
        throw error;
      }
    }
  }

  return result;
}
