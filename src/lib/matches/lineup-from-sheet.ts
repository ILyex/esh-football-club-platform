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
const SUBSTITUTE = /احتياط|بديل|دكه|substitut|remplacant|banc/;

function detectPlayers(text: string, players: SheetPlayer[]): Map<string, "STARTING" | "SUBSTITUTE"> {
  const found = new Map<string, "STARTING" | "SUBSTITUTE">();
  let section: "STARTING" | "SUBSTITUTE" | null = null;

  for (const rawLine of text.split(/[\r\n]+/)) {
    const line = normalize(rawLine);
    if (!line) continue;
    const isStartingSection = STARTING.test(line);
    const isSubstituteSection = SUBSTITUTE.test(line);
    if (isStartingSection && !isSubstituteSection) section = "STARTING";
    else if (isSubstituteSection) section = "SUBSTITUTE";

    for (const player of players) {
      if (found.has(player.id)) continue;
      const first = normalize(player.firstName);
      const last = normalize(player.lastName);
      const named = first.length > 1 && last.length > 1 && line.includes(first) && line.includes(last);
      const number = player.shirtNumber == null ? null : String(player.shirtNumber);
      const numbered = Boolean(number && new RegExp(`(?:^|\\s)${number}(?:\\s|$)`).test(line));
      const licence = normalize(player.licenceNumber || "").replace(/\s/g, "");
      const lineCompact = line.replace(/\s/g, "");
      const licensed = licence.length >= 5 && lineCompact.includes(licence);
      if (!named && !numbered && !licensed) continue;

      const explicitStarting = STARTING.test(line);
      const explicitSubstitute = SUBSTITUTE.test(line);
      const status = explicitSubstitute
        ? "SUBSTITUTE"
        : explicitStarting
          ? "STARTING"
          : section;
      if (status) found.set(player.id, status);
    }
  }
  return found;
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
    const lineCompact = line.replace(/\s/g, "");
    for (const player of players) {
      if (numbers.has(player.id)) continue;
      const first = normalize(player.firstName);
      const last = normalize(player.lastName);
      const named = first.length > 1 && last.length > 1 && line.includes(first) && line.includes(last);
      const licence = normalize(player.licenceNumber || "").replace(/\s/g, "");
      const licensed = licence.length >= 5 && lineCompact.includes(licence);
      if (named || licensed) numbers.set(player.id, shirtNumber);
    }
  }
  return numbers;
}

/**
 * Apply the official FAF match sheet as the source of who was called up.
 * Players missing from a sufficiently legible sheet become NOT_CALLED.
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
  const officialShirtNumbers = detectOfficialShirtNumbers(text, players);
  const starters = [...detected.values()].filter((status) => status === "STARTING").length;
  const substitutes = [...detected.values()].filter((status) => status === "SUBSTITUTE").length;
  // Prevent OCR noise or an unrelated page from clearing a previously entered lineup.
  if (starters < 7) {
    return { applied: false, starters, substitutes, notCalled: 0, injured: 0, suspended: 0, reason: "insufficient_recognition" };
  }

  const existingLineups = await db.matchLineup.findMany({ where: { matchId }, select: { playerId: true, selectionStatus: true, shirtNumber: true } });
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
    for (const player of players) {
      const detectedStatus = detected.get(player.id);
      const existing = existingById.get(player.id);
      const existingStatus = existing?.selectionStatus;
      const selectionStatus = suspendedIds.has(player.id)
        ? "SUSPENDED"
        : detectedStatus ?? (existingStatus === "INJURED" || player.status === "INJURED" ? "INJURED" : "NOT_CALLED");
      const isStarting = selectionStatus === "STARTING";
      counts[selectionStatus as keyof typeof counts]++;
      await tx.matchLineup.upsert({
        where: { matchId_playerId: { matchId, playerId: player.id } },
        create: { matchId, playerId: player.id, isStarting, selectionStatus, position: player.position, shirtNumber: officialShirtNumbers.get(player.id) ?? null },
        update: { isStarting, selectionStatus, position: player.position, shirtNumber: officialShirtNumbers.get(player.id) ?? existing?.shirtNumber ?? undefined }
      });
    }
  });

  return { applied: true, starters: counts.STARTING, substitutes: counts.SUBSTITUTE, notCalled: counts.NOT_CALLED, injured: counts.INJURED, suspended: counts.SUSPENDED };
}
