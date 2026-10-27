import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type SheetPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  firstNameFr: string | null;
  lastNameFr: string | null;
  shirtNumber: number | null;
  licenceNumber: string | null;
  position: string;
  status: string;
};

type SelectionStatus = "STARTING" | "SUBSTITUTE" | "NOT_CALLED";
type DetectedLineup = {
  players: Map<string, SelectionStatus>;
  hasStarterSection: boolean;
  hasBenchSection: boolean;
  hasExplicitNotCalledSection: boolean;
  warnings: string[];
};

export type MatchSheetLineupResult = {
  applied: boolean;
  starters: number;
  substitutes: number;
  notCalled: number;
  injured: number;
  suspended: number;
  untouched: number;
  warnings: string[];
  reason?: "no_roster" | "insufficient_recognition";
};

function normalize(value: string): string {
  return value.toLocaleLowerCase("ar")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ç/g, "c")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function nameVariants(player: SheetPlayer): string[][] {
  const variants = [
    [player.firstName, player.lastName],
    [player.lastName, player.firstName],
    [player.firstNameFr, player.lastNameFr],
    [player.lastNameFr, player.firstNameFr]
  ];
  const unique = new Map<string, string[]>();
  for (const parts of variants) {
    const tokens = parts.map((part) => normalize(part || "")).filter(Boolean).flatMap((part) => part.split(" "));
    if (tokens.length >= 2) unique.set(tokens.join(" "), tokens);
  }
  return [...unique.values()];
}

function playerMatchesLine(line: string, player: SheetPlayer): boolean {
  const normalizedLine = ` ${normalize(line)} `;
  const lineTokens = new Set(normalizedLine.trim().split(/\s+/u).filter(Boolean));
  const hasName = nameVariants(player).some((tokens) => tokens.every((token) => lineTokens.has(token)));
  const licence = normalize(player.licenceNumber || "").replace(/\s/g, "");
  const licensed = licence.length >= 5 && normalizedLine.replace(/\s/g, "").includes(licence);
  return hasName || licensed;
}

const STARTING = /اساسي|التشكيل الاساسي|التشكيله الاساسيه|titulaires?|onze de depart|equipe titulaire|joueurs titulaires/;
const SUBSTITUTE = /احتياط|بديل|بدلاء|دكه|remplacants?|banc|rempla[cç]ants? disponibles/;
const NOT_CALLED = /non convoques?|non retenus?|absents?|joueurs absents|غير مستدعى|غير مدعو|غيابات|قائمة الغياب/;
const OUTSIDE_LINEUP = /arbitres?|officiels?|delegues?|entraineurs?|coach|staff|encadrement|observations?|remarques?|signatures?|sanctions?|cartons?|buts?|evenements?|remplacements?|blesses?|score|resultat|blessures?|rapport|referees?|طاقم|حكام|مدربين|ملاحظات|توقيعات|عقوبات|بطاقات|اهداف|أهداف|احداث|أحداث|نتيجه|نتيجة/;

function detectPlayers(text: string, players: SheetPlayer[]): DetectedLineup {
  const found = new Map<string, SelectionStatus>();
  const warnings: string[] = [];
  let section: SelectionStatus | null = null;
  let hasStarterSection = false;
  let hasBenchSection = false;
  let hasExplicitNotCalledSection = false;

  for (const rawLine of text.split(/[\r\n]+/u)) {
    const line = normalize(rawLine);
    if (!line) continue;
    const startingAt = line.search(STARTING);
    const substituteAt = line.search(SUBSTITUTE);
    const notCalledAt = line.search(NOT_CALLED);
    const isOutsideLineup = OUTSIDE_LINEUP.test(line);

    // Explicit list headings reset the current list before names on that line
    // are considered. Players omitted from a document are never treated as
    // uncalled; only names inside a dedicated absence section get that status.
    if (isOutsideLineup && startingAt < 0 && substituteAt < 0 && notCalledAt < 0) {
      section = null;
      continue;
    }
    const headings = [
      { at: startingAt, status: "STARTING" as const },
      { at: substituteAt, status: "SUBSTITUTE" as const },
      { at: notCalledAt, status: "NOT_CALLED" as const }
    ].filter((heading) => heading.at >= 0).sort((a, b) => a.at - b.at);
    if (headings.length > 1) {
      // A PDF may merge its two columns into one line. Keep this row
      // ambiguous rather than assigning bench players to the starting XI.
      warnings.push("اختلطت عناوين أقسام القائمة في سطر واحد؛ تُركت الأسماء الملتبسة للمراجعة.");
      section = headings.at(-1)?.status ?? null;
      if (headings.some((heading) => heading.status === "STARTING")) hasStarterSection = true;
      if (headings.some((heading) => heading.status === "SUBSTITUTE")) hasBenchSection = true;
      if (headings.some((heading) => heading.status === "NOT_CALLED")) hasExplicitNotCalledSection = true;
      continue;
    }
    if (headings.length === 1) {
      section = headings[0]!.status;
      if (section === "STARTING") hasStarterSection = true;
      if (section === "SUBSTITUTE") hasBenchSection = true;
      if (section === "NOT_CALLED") hasExplicitNotCalledSection = true;
    }

    const candidates = players.filter((player) => playerMatchesLine(rawLine, player));
    if (!section || candidates.length === 0) continue;
    if (candidates.length > 1) {
      warnings.push("تعذر فصل بعض أسماء اللاعبين في الوثيقة بشكل موثوق؛ لم تُسند هذه الأسماء تلقائياً.");
      continue;
    }
    const player = candidates[0]!;
    const previous = found.get(player.id);
    if (previous && previous !== section) {
      warnings.push("ظهر لاعب في أكثر من قسم مختلف في الوثيقة؛ تُرك تصنيفه للمراجعة اليدوية.");
      found.delete(player.id);
      continue;
    }
    if (!previous) found.set(player.id, section);
  }

  return { players: found, hasStarterSection, hasBenchSection, hasExplicitNotCalledSection, warnings: [...new Set(warnings)] };
}

function detectOfficialCaptain(text: string, players: SheetPlayer[]): string | null {
  for (const rawLine of text.split(/[\r\n]+/u)) {
    if (!/(?:^|\s)\(?C\)?(?=\s|$|[.)])/i.test(rawLine)) continue;
    const candidates = players.filter((player) => playerMatchesLine(rawLine, player));
    if (candidates.length === 1) return candidates[0]!.id;
  }
  return null;
}

function detectOfficialShirtNumbers(text: string, players: SheetPlayer[]): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const rawLine of text.split(/[\r\n]+/u)) {
    const leadingNumber = rawLine.match(/^\s*(\d{1,2})(?=\s|\.)/u);
    if (!leadingNumber) continue;
    const shirtNumber = Number(leadingNumber[1]);
    if (shirtNumber < 1 || shirtNumber > 99) continue;
    const candidates = players.filter((player) => playerMatchesLine(rawLine, player));
    if (candidates.length === 1) numbers.set(candidates[0]!.id, shirtNumber);
  }
  return numbers;
}

/**
 * Imports only classifications explicitly supported by the match sheet.
 * Missing names remain available for manual selection; they are not silently
 * changed to NOT_CALLED. Injuries remain manual and previous-match red cards
 * remain automatically suspended.
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
    select: { id: true, firstName: true, lastName: true, firstNameFr: true, lastNameFr: true, shirtNumber: true, licenceNumber: true, position: true, status: true }
  });
  if (players.length === 0) return { applied: false, starters: 0, substitutes: 0, notCalled: 0, injured: 0, suspended: 0, untouched: 0, warnings: [], reason: "no_roster" };

  const detected = detectPlayers(text, players);
  const officialCaptainId = detectOfficialCaptain(text, players);
  const officialShirtNumbers = detectOfficialShirtNumbers(text, players);
  const previousMatch = match.competitionId
    ? await db.match.findFirst({
        where: { teamId, competitionId: match.competitionId, status: "FINISHED", matchDate: { lt: match.matchDate } },
        orderBy: { matchDate: "desc" },
        select: { events: { where: { type: "RED_CARD" }, select: { playerId: true, playerName: true, playerNameFr: true } } }
      })
    : null;
  const suspendedIds = new Set<string>();
  for (const event of previousMatch?.events ?? []) {
    if (event.playerId) {
      suspendedIds.add(event.playerId);
      continue;
    }
    for (const eventName of [event.playerName, event.playerNameFr].filter((name): name is string => Boolean(name))) {
      const candidates = players.filter((player) => playerMatchesLine(eventName, player));
      if (candidates.length === 1) suspendedIds.add(candidates[0]!.id);
    }
  }

  // Never infer that unmatched starting names belong on the bench. A second
  // goalkeeper or an impossible >11 starters is a parser conflict, not a
  // license to rewrite the player's status.
  const warnings = [...detected.warnings];
  const existingLineups = await db.matchLineup.findMany({ where: { matchId }, select: { playerId: true, selectionStatus: true, shirtNumber: true, isCaptain: true } });
  const existingById = new Map(existingLineups.map((entry) => [entry.playerId, entry]));
  const playerById = new Map(players.map((player) => [player.id, player]));
  const listedStartingIds = [...detected.players].filter(([, status]) => status === "STARTING").map(([id]) => id);
  const startingIds = listedStartingIds.filter((id) => !suspendedIds.has(id)
    && playerById.get(id)?.status !== "INJURED" && existingById.get(id)?.selectionStatus !== "INJURED");
  const goalkeeperIds = startingIds.filter((id) => players.find((player) => player.id === id)?.position === "GOALKEEPER");
  if (listedStartingIds.length > 11) {
    warnings.push("تجاوز عدد الأساسيين 11 لاعباً؛ لم تُطبق التشكيلة لتجنب حفظ قراءة خاطئة.");
  }
  if (goalkeeperIds.length > 1) {
    warnings.push("ظهرت أسماء أكثر من حارس كأساسي؛ لم تُطبق التشكيلة لتجنب تثبيت حراس في مراكز خاطئة.");
  }

  const starterCount = startingIds.length;
  const substituteCount = [...detected.players.values()].filter((status) => status === "SUBSTITUTE").length;
  const hasRosterStructure = detected.hasExplicitNotCalledSection || (detected.hasBenchSection && substituteCount > 0);
  if (!detected.hasStarterSection || !hasRosterStructure || starterCount < 7 || listedStartingIds.length > 11 || goalkeeperIds.length > 1) {
    if (!hasRosterStructure) warnings.push("لم يُتعرف على حدّ فاصل موثوق بين الأساسيين والاحتياط/غير المستدعين؛ لم تُغيّر حالات اللاعبين.");
    return {
      applied: false,
      starters: starterCount,
      substitutes: substituteCount,
      notCalled: 0,
      injured: 0,
      suspended: 0,
      untouched: players.length,
      warnings,
      reason: "insufficient_recognition"
    };
  }

  const counts = { STARTING: 0, SUBSTITUTE: 0, NOT_CALLED: 0, INJURED: 0, SUSPENDED: 0 };
  const classifiedIds = new Set<string>();
  let restoredUnlistedPlayers = 0;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    if (officialCaptainId && detected.players.get(officialCaptainId) === "STARTING") {
      await tx.matchLineup.updateMany({ where: { matchId, isCaptain: true, playerId: { not: officialCaptainId } }, data: { isCaptain: false } });
    }
    for (const player of players) {
      const detectedStatus = detected.players.get(player.id);
      const existing = existingById.get(player.id);
      const existingStatus = existing?.selectionStatus;
      const isSuspended = suspendedIds.has(player.id);
      const isManuallyInjured = player.status === "INJURED" || existingStatus === "INJURED";

      // A valid report explicitly identifies the prior red-card suspension;
      // a manual injury remains authoritative over the sheet.
      if (isSuspended) {
        counts.SUSPENDED++;
        classifiedIds.add(player.id);
        await tx.matchLineup.upsert({
          where: { matchId_playerId: { matchId, playerId: player.id } },
          create: { matchId, playerId: player.id, isStarting: false, isCaptain: false, selectionStatus: "SUSPENDED", position: player.position },
          update: { isStarting: false, isCaptain: false, selectionStatus: "SUSPENDED", position: player.position }
        });
        continue;
      }
      if (isManuallyInjured) {
        counts.INJURED++;
        classifiedIds.add(player.id);
        await tx.matchLineup.upsert({
          where: { matchId_playerId: { matchId, playerId: player.id } },
          create: { matchId, playerId: player.id, isStarting: false, isCaptain: false, selectionStatus: "INJURED", position: player.position },
          update: { isStarting: false, isCaptain: false, selectionStatus: "INJURED", position: player.position }
        });
        continue;
      }

      if (!detectedStatus && existing && ["STARTING", "SUBSTITUTE", "NOT_CALLED", "SUSPENDED"].includes(existingStatus || "")) {
        // Earlier imports could assign a status to a player because OCR missed
        // their name. Remove stale inferred assignments so they return to the
        // available roster. Only an explicit row in the document can create a
        // NOT_CALLED status.
        await tx.matchLineup.deleteMany({ where: { matchId, playerId: player.id } });
        restoredUnlistedPlayers++;
        continue;
      }

      // Missing or unreadable lines mean unknown, not uncalled. Only a player
      // explicitly present in a labeled absence section may be marked so.
      const status = detectedStatus;
      if (!status) continue;
      const isStarting = status === "STARTING";
      counts[status]++;
      classifiedIds.add(player.id);
      await tx.matchLineup.upsert({
        where: { matchId_playerId: { matchId, playerId: player.id } },
        create: {
          matchId, playerId: player.id, isCaptain: isStarting && player.id === officialCaptainId, isStarting, selectionStatus: status,
          position: player.position, shirtNumber: officialShirtNumbers.get(player.id) ?? null
        },
        update: {
          isCaptain: isStarting && (officialCaptainId ? player.id === officialCaptainId : existing?.isCaptain ?? false),
          isStarting, selectionStatus: status, position: player.position,
          shirtNumber: officialShirtNumbers.get(player.id) ?? existing?.shirtNumber ?? undefined
        }
      });
    }
  });

  if (!detected.hasBenchSection) warnings.push("لم يُتعرف على قسم الاحتياط؛ تُرك اللاعبون غير المذكورين دون تغيير ليتم توزيعهم يدوياً.");
  if (restoredUnlistedPlayers) warnings.push(`أُعيد ${restoredUnlistedPlayers} لاعباً إلى قائمة المتاحين؛ غياب الاسم عن التشكيلة لا يكفي لتصنيفه غير مستدعى.`);
  return {
    applied: true,
    starters: counts.STARTING,
    substitutes: counts.SUBSTITUTE,
    notCalled: counts.NOT_CALLED,
    injured: counts.INJURED,
    suspended: counts.SUSPENDED,
    untouched: Math.max(0, players.length - classifiedIds.size),
    warnings: [...new Set(warnings)]
  };
}
