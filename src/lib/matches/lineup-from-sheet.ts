import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type SheetPlayer = {
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

export type SelectionStatus = "STARTING" | "SUBSTITUTE" | "NOT_CALLED";
export type DetectedLineup = {
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

export function normalizeCompoundNames(text: string): string {
  return text
    .replace(/\b(بن|ابن|بو|بل|عبد|ايت)\s+/gu, "$1")
    .replace(/\b(ben|bou|bel|abd|abdel|ait)\s+/giu, "$1");
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

export function playerMatchesLine(line: string, player: SheetPlayer): boolean {
  const normalizedLine = ` ${normalize(line)} `;
  const compoundLine = ` ${normalizeCompoundNames(normalizedLine)} `;
  const lineTokens = new Set(compoundLine.trim().split(/\s+/u).filter(Boolean));

  // 1. Licence number match
  const rawLicence = normalize(player.licenceNumber || "").replace(/\s/g, "");
  if (rawLicence.length >= 5 && compoundLine.replace(/\s/g, "").includes(rawLicence)) {
    return true;
  }
  const digitsMatch = rawLicence.match(/\d{5,}/);
  if (digitsMatch && compoundLine.replace(/[^\d]/g, "").includes(digitsMatch[0])) {
    return true;
  }

  // 2. Exact or compound name match
  const variants = [
    { first: player.firstName, last: player.lastName },
    { first: player.firstNameFr, last: player.lastNameFr }
  ];

  for (const { first, last } of variants) {
    if (!last) continue;
    const normLast = normalizeCompoundNames(normalize(last));
    const normFirst = normalizeCompoundNames(normalize(first || ""));
    const lastTokens = normLast.split(" ").filter(Boolean);
    const firstTokens = normFirst.split(" ").filter(Boolean);
    const allTokens = [...lastTokens, ...firstTokens];
    if (allTokens.length < 2) continue;

    const full1 = `${normLast} ${normFirst}`;
    const full2 = `${normFirst} ${normLast}`;
    if (compoundLine.includes(` ${full1} `) || compoundLine.includes(` ${full2} `)) {
      return true;
    }

    // Check if last name is matched in line
    const lastMatched = lastTokens.every((t) => lineTokens.has(t))
      || (lastTokens.length > 0 && compoundLine.includes(lastTokens.join("")));

    if (lastMatched) {
      if (firstTokens.length === 0) return true;
      const matchedFirst = firstTokens.filter((t) => lineTokens.has(t)).length;
      if (matchedFirst > 0 || (firstTokens.length > 1 && matchedFirst / firstTokens.length >= 0.5)) {
        return true;
      }
    }

    // Substantial token overlap (handles middle name omissions or reorderings)
    const matchedCount = allTokens.filter((t) => lineTokens.has(t)).length;
    if (allTokens.length >= 3 && matchedCount / allTokens.length >= 0.66) {
      return true;
    }
  }

  return false;
}

const STARTING = /اساسي|الاساسيون|الاساسيين|الاساسية|التشكيل الاساسي|التشكيلة الاساسية|التشكيله الاساسيه|قائمة البداية|قائمة الاساسيين|قائمة اللاعبين الاساسيين|التشكيل|التشكيلة|الفريق\s+الاساسي|titulaires?|onze de depart|equipe titulaire|joueurs titulaires|composition|starting/iu;
const SUBSTITUTE = /احتياط|الاحتياط|الاحتياطيون|الاحتياطيين|قائمة الاحتياط|اللاعبين الاحتياط|اللاعبون الاحتياطيون|بدلاء|البدلاء|قائمة البدلاء|دكة البدلاء|دكه البدلاء|اللاعبين البدلاء|اللاعبون البدلاء|(?:^|[\s_،,.-])(?:ال)?بديل(?:ين|ان|ة|ه)?(?=$|[\s_،,.-])|معوض|معوضين|المعوضين|قائمة المعوضين|اللاعبين المعوضين|remplacants?|banc|rempla[cç]ants?|substitutes?|reserves?|reservistes?/iu;
const NOT_CALLED = /non convoques?|non retenus?|absents?|joueurs absents|غير مستدعى|غير مدعو|غيابات|قائمة الغياب/iu;
const OUTSIDE_LINEUP = /arbitres?|officiels?|delegues?|entraineurs?|coach|staff|encadrement|observations?|remarques?|signatures?|sanctions?|cartons?|buts?|evenements?|blesses?|score|resultat|blessures?|referees?|طاقم|حكام|مدربين|ملاحظات|توقيعات|عقوبات|بطاقات|انذار|انذارات|طرد|اهداف|أهداف|احداث|أحداث|نتيجه|نتيجة|(?:^|\s)(?:ملاحظات\s+الحكم|تقرير\s+الحكم)(?:\s|$)/iu;

export function detectPlayers(text: string, players: SheetPlayer[]): DetectedLineup {
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

export function detectOfficialCaptain(text: string, players: SheetPlayer[]): string | null {
  for (const rawLine of text.split(/[\r\n]+/u)) {
    if (!/(?:^|\s)\(?(?:C|ق)\)?(?=\s|$|[.)])/i.test(rawLine) && !/(?:^|\s)(?:قائد|capitaine)(?=\s|$|[.)])/i.test(rawLine)) continue;
    const candidates = players.filter((player) => playerMatchesLine(rawLine, player));
    if (candidates.length === 1) return candidates[0]!.id;
  }
  return null;
}

export function detectOfficialShirtNumbers(text: string, players: SheetPlayer[]): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const rawLine of text.split(/[\r\n]+/u)) {
    let shirtNumber: number | null = null;
    const leadingNumber = rawLine.match(/^\s*(\d{1,2})(?=[\s.-])/u);
    if (leadingNumber) {
      shirtNumber = Number(leadingNumber[1]);
    } else {
      const trailingNumber = rawLine.match(/(?:^|\s)(\d{1,2})(?:\s*\(?[cCق]\)?|\s*$)/u);
      if (trailingNumber) {
        shirtNumber = Number(trailingNumber[1]);
      }
    }
    if (!shirtNumber || shirtNumber < 1 || shirtNumber > 99) continue;
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

  // 1. Cross-reference with substitution events (database and document):
  // Players who entered as substitutes (SUBSTITUTION_IN) or exited (SUBSTITUTION_OUT)
  const subsInIds = new Set<string>();
  const subsOutIds = new Set<string>();

  const existingEvents = await db.matchEvent.findMany({
    where: { matchId },
    select: { type: true, playerId: true, playerName: true, playerNameFr: true }
  });
  for (const ev of existingEvents) {
    let resolvedId = ev.playerId;
    if (!resolvedId) {
      for (const evName of [ev.playerName, ev.playerNameFr].filter((n): n is string => Boolean(n))) {
        const c = players.filter((p) => playerMatchesLine(evName, p));
        if (c.length === 1) {
          resolvedId = c[0]!.id;
          break;
        }
      }
    }
    if (resolvedId) {
      if (ev.type === "SUBSTITUTION_IN") subsInIds.add(resolvedId);
      if (ev.type === "SUBSTITUTION_OUT") subsOutIds.add(resolvedId);
    }
  }

  for (const player of players) {
    for (const rawLine of text.split(/[\r\n]+/u)) {
      if (playerMatchesLine(rawLine, player)) {
        if (/دخول|بديل\s+داخل|entrant|remplaçant\s+entrant/iu.test(rawLine)) {
          subsInIds.add(player.id);
        } else if (/خروج|مستبدل|sortant|joueur\s+sortant/iu.test(rawLine)) {
          subsOutIds.add(player.id);
        }
      }
    }
  }

  // Any player who was subbed IN was on the bench
  for (const inId of subsInIds) {
    detected.players.set(inId, "SUBSTITUTE");
    detected.hasBenchSection = true;
  }
  // Any player who was subbed OUT was a starter
  for (const outId of subsOutIds) {
    if (detected.players.has(outId)) {
      detected.players.set(outId, "STARTING");
    }
  }

  // If all players were placed in STARTING because no bench header was matched
  // (e.g. FAF EMS Page 1 with continuous roster), but there are >11 players:
  // In football sheets, the first 11 are the starting XI, and remaining are bench.
  const startingEntries = [...detected.players.entries()].filter(([, status]) => status === "STARTING");
  if (startingEntries.length > 11 && !detected.hasBenchSection) {
    let assigned = 0;
    for (const [id] of startingEntries) {
      if (subsInIds.has(id)) {
        detected.players.set(id, "SUBSTITUTE");
        continue;
      }
      if (assigned < 11 || subsOutIds.has(id)) {
        detected.players.set(id, "STARTING");
        assigned++;
      } else {
        detected.players.set(id, "SUBSTITUTE");
      }
    }
    detected.hasBenchSection = true;
  }

  // If more than 1 goalkeeper is in starting lineup:
  // In football squads, the first GK stays in STARTING, the backup GK moves to SUBSTITUTE
  const currentGkStarters = [...detected.players.entries()]
    .filter(([id, status]) => status === "STARTING" && playerById.get(id)?.position === "GOALKEEPER")
    .map(([id]) => id);
  if (currentGkStarters.length > 1) {
    for (let i = 1; i < currentGkStarters.length; i++) {
      detected.players.set(currentGkStarters[i]!, "SUBSTITUTE");
      detected.hasBenchSection = true;
    }
  }

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
  if (starterCount >= 7 && (substituteCount > 0 || detected.hasBenchSection)) {
    detected.hasStarterSection = true;
  }
  const hasRosterStructure = detected.hasExplicitNotCalledSection || detected.hasBenchSection || substituteCount > 0
    || (starterCount === 11 && goalkeeperIds.length === 1);
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
