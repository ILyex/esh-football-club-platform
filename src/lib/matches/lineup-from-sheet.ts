import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type SheetPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  licenceNumber: string | null;
  position: string;
  status: string;
};

export type MatchSheetLineupResult = {
  applied: boolean;
  starters: number;
  substitutes: number;
  notCalled: number;
  injured: number;
  suspended: number;
  reason?: "no_roster" | "insufficient_recognition";
};

function normalize(value: string): string {
  return value.toLocaleLowerCase("ar")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const STARTING = /اساسي|التشكيل الاساسي|التشكيله الاساسيه|starting|titulaires?|onze de depart/;
const SUBSTITUTE = /احتياط|بديل|بدلاء|دكه|substitut|remplacant|banc/;

const OUTSIDE_LINEUP = /arbitres?|officiels?|delegues?|entraineurs?|coach|staff|encadrement|observations?|remarques?|signatures?|sanctions?|cartons?|buts?|evenements?|remplacements?|score|resultat|blessures?|rapport|referees?|طاقم|حكام|مدربين|ملاحظات|توقيعات|عقوبات|بطاقات|اهداف|أهداف|احداث|أحداث|نتيجه|نتيجة/;

function playerMatchesLine(line: string, player: SheetPlayer): boolean {
  const tokens = new Set(line.split(/\s+/u).filter(Boolean));
  const firstTokens = normalize(player.firstName).split(/\s+/u).filter(Boolean);
  const lastTokens = normalize(player.lastName).split(/\s+/u).filter(Boolean);
  const hasName = firstTokens.length > 0 && lastTokens.length > 0
    && [...firstTokens, ...lastTokens].every((token) => tokens.has(token));
  const licence = normalize(player.licenceNumber || "").replace(/\s/g, "");
  const licensed = licence.length >= 5 && line.replace(/\s/g, "").includes(licence);
  return hasName || licensed;
}

function detectPlayers(text: string, players: SheetPlayer[]): Map<string, "STARTING" | "SUBSTITUTE"> {
  const found = new Map<string, "STARTING" | "SUBSTITUTE">();
  let section: "STARTING" | "SUBSTITUTE" | null = null;

  for (const rawLine of text.split(/[\r\n]+/)) {
    const line = normalize(rawLine);
    if (!line) continue;
    const isStartingSection = STARTING.test(line);
    const isSubstituteSection = SUBSTITUTE.test(line);
    const isOutsideLineup = OUTSIDE_LINEUP.test(line);
    if (isOutsideLineup && !isStartingSection && !isSubstituteSection) {
      section = null;
      continue;
    }

    // Names and licences identify roster members; shirt numbers alone are too
    // ambiguous. Ignore any OCR row that matches multiple players.
    const candidates = players.filter((player) => !found.has(player.id) && playerMatchesLine(line, player));
    if (candidates.length === 1) {
      const explicitStatus = isSubstituteSection ? "SUBSTITUTE" : isStartingSection ? "STARTING" : null;
      const status = explicitStatus ?? section;
      if (status) found.set(candidates[0]!.id, status);
    }

    // Some sheets put the section label and the first player's name on one line.
    if (isStartingSection && !isSubstituteSection) section = "STARTING";
    else if (isSubstituteSection) section = "SUBSTITUTE";
  }
  return found;
}

function detectOfficialCaptain(text: string, players: SheetPlayer[]): string | null {
  for (const rawLine of text.split(/[\r\n]+/)) {
    // FAF sheets place C beside the captain's shirt number/name. Requiring a
    // standalone marker avoids treating the letter in a name or a column as it.
    if (!/(?:^|\s)\(?C\)?(?=\s|$|[.)])/i.test(rawLine)) continue;
    const line = normalize(rawLine);
    const candidates = players.filter((player) => playerMatchesLine(line, player));
    if (candidates.length === 1) return candidates[0]!.id;
  }
  return null;
}

/** Read a jersey only when it is an unambiguous leading column on the same
 * sheet row as a known player. Never infer it from digits inside a licence. */
function detectOfficialShirtNumbers(text: string, players: SheetPlayer[]): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const rawLine of text.split(/[\r\n]+/)) {
    const leadingNumber = rawLine.match(/^\s*(\d{1,2})(?=\s|\.)/);
    if (!leadingNumber) continue;
    const shirtNumber = Number(leadingNumber[1]);
    if (shirtNumber < 1 || shirtNumber > 99) continue;
    const line = normalize(rawLine);
    const candidates = players.filter((player) => !numbers.has(player.id) && playerMatchesLine(line, player));
    if (candidates.length === 1) numbers.set(candidates[0]!.id, shirtNumber);
  }
  return numbers;
}

/**
 * Apply the official FAF match sheet as the source of who was called up.
 * Only confidently recognized players are changed; partial/OCR-derived pages
 * must not turn the rest of the roster into NOT_CALLED.
 * Existing manually recorded injuries are retained; previous-match red cards
 * in this competition take precedence over the sheet and become SUSPENDED.
 */
export async function applyMatchSheetLineup(
  matchId: string,
  teamId: string,
  text: string
): Promise<MatchSheetLineupResult> {
  const match = await db.match.findUniqueOrThrow({
    where: { id: matchId },
    select: { teamId: true, competitionId: true, matchDate: true, team: { select: { category: true } } }
  });
  const eligibleTeamIds = match.team?.category === "SENIOR"
    ? [teamId, ...(await db.team.findUnique({ where: { category: "U20" }, select: { id: true } }).then((team) => team?.id ? [team.id] : []))]
    : [teamId];
  const players = await db.player.findMany({
    where: { teamId: { in: eligibleTeamIds }, status: { not: "ARCHIVED" } },
    select: { id: true, firstName: true, lastName: true, shirtNumber: true, licenceNumber: true, position: true, status: true }
  });
  if (players.length === 0) return { applied: false, starters: 0, substitutes: 0, notCalled: 0, injured: 0, suspended: 0, reason: "no_roster" };

  const detected = detectPlayers(text, players);
  const officialCaptainId = detectOfficialCaptain(text, players);
  if (officialCaptainId && detected.has(officialCaptainId)) detected.set(officialCaptainId, "STARTING");
  const officialShirtNumbers = detectOfficialShirtNumbers(text, players);
  const starters = [...detected.values()].filter((status) => status === "STARTING").length;
  const substitutes = [...detected.values()].filter((status) => status === "SUBSTITUTE").length;
  // Prevent OCR noise or an unrelated page from clearing a previously entered lineup.
  if (starters < 7) {
    return { applied: false, starters, substitutes, notCalled: 0, injured: 0, suspended: 0, reason: "insufficient_recognition" };
  }

  const existingLineups = await db.matchLineup.findMany({ where: { matchId }, select: { playerId: true, selectionStatus: true, shirtNumber: true, isCaptain: true } });
  const previousMatch = match.competitionId
    ? await db.match.findFirst({
        where: { teamId, competitionId: match.competitionId, status: "FINISHED", matchDate: { lt: match.matchDate } },
        orderBy: { matchDate: "desc" },
        select: { events: { where: { type: "RED_CARD", playerId: { not: null } }, select: { playerId: true } } }
      })
    : null;
  const suspendedIds = new Set(previousMatch?.events.flatMap((event) => event.playerId ? [event.playerId] : []) ?? []);
  const existingById = new Map(existingLineups.map((entry) => [entry.playerId, entry]));
  const counts = { STARTING: 0, SUBSTITUTE: 0, NOT_CALLED: 0, INJURED: 0, SUSPENDED: 0 };

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    if (officialCaptainId && detected.has(officialCaptainId)) {
      await tx.matchLineup.updateMany({ where: { matchId, isCaptain: true, playerId: { not: officialCaptainId } }, data: { isCaptain: false } });
    }
    for (const player of players) {
      const detectedStatus = detected.get(player.id);
      const existing = existingById.get(player.id);
      const existingStatus = existing?.selectionStatus;
      // The recognized sheet is authoritative for starters and substitutes.
      // Remove stale lineup rows from earlier broad OCR passes, but retain
      // explicit injury/suspension states that are not listed on this sheet.
      if (!detectedStatus) {
        const preservedStatus = suspendedIds.has(player.id) || existingStatus === "SUSPENDED"
          ? "SUSPENDED"
          : existingStatus === "INJURED" ? "INJURED" : null;
        if (!preservedStatus) {
          if (existing) await tx.matchLineup.delete({ where: { matchId_playerId: { matchId, playerId: player.id } } });
          continue;
        }
        counts[preservedStatus]++;
        await tx.matchLineup.upsert({
          where: { matchId_playerId: { matchId, playerId: player.id } },
          create: { matchId, playerId: player.id, isStarting: false, isCaptain: false, selectionStatus: preservedStatus, position: player.position },
          update: { isStarting: false, isCaptain: false, selectionStatus: preservedStatus }
        });
        continue;
      }
      const selectionStatus = suspendedIds.has(player.id)
        ? "SUSPENDED"
        : detectedStatus;
      const isStarting = selectionStatus === "STARTING";
      counts[selectionStatus as keyof typeof counts]++;
      await tx.matchLineup.upsert({
        where: { matchId_playerId: { matchId, playerId: player.id } },
        create: { matchId, playerId: player.id, isCaptain: isStarting && player.id === officialCaptainId, isStarting, selectionStatus, position: player.position, shirtNumber: officialShirtNumbers.get(player.id) ?? null },
        update: { isCaptain: isStarting && (officialCaptainId ? player.id === officialCaptainId : existing?.isCaptain ?? false), isStarting, selectionStatus, position: player.position, shirtNumber: officialShirtNumbers.get(player.id) ?? existing?.shirtNumber ?? undefined }
      });
    }
  });

  return { applied: true, starters: counts.STARTING, substitutes: counts.SUBSTITUTE, notCalled: counts.NOT_CALLED, injured: counts.INJURED, suspended: counts.SUSPENDED };
}
