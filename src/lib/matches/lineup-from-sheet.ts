import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseReportDeterministically } from "@/lib/ai/referee-report-ai-service";

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

export type PlayerEventSummary = {
  type: string;
  playerId?: string | null;
  playerName?: string | null;
  playerNameFr?: string | null;
  minute?: number | null;
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
    .replace(/(^|[\s_،,.-])(بن|ابن|بو|بل|عبد|ايت)\s+/gu, "$1$2")
    .replace(/(^|[\s_،,.-])(ben|bou|bel|abd|abdel|ait)\s+/giu, "$1$2");
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
    if (allTokens.length < 1) continue;

    const full1 = `${normLast} ${normFirst}`.trim();
    const full2 = `${normFirst} ${normLast}`.trim();
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

    let candidates = players.filter((player) => playerMatchesLine(rawLine, player));
    if (!section || candidates.length === 0) continue;
    if (candidates.length > 1) {
      // If one candidate is an exact full name match and others are only partial token matches,
      // pick the exact match.
      const exactMatches = candidates.filter((player) => {
        const normLast = normalizeCompoundNames(normalize(player.lastName));
        const normFirst = normalizeCompoundNames(normalize(player.firstName || ""));
        const compoundLine = ` ${normalizeCompoundNames(normalize(rawLine))} `;
        return compoundLine.includes(` ${normLast} ${normFirst} `) || compoundLine.includes(` ${normFirst} ${normLast} `);
      });
      if (exactMatches.length === 1) {
        candidates = exactMatches;
      } else {
        warnings.push("تعذر فصل بعض أسماء اللاعبين في الوثيقة بشكل موثوق؛ لم تُسند هذه الأسماء تلقائياً.");
        continue;
      }
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

export function resolvePlayerSelections(params: {
  detected: DetectedLineup;
  players: SheetPlayer[];
  events: PlayerEventSummary[];
  officialCaptainId?: string | null;
  suspendedIds?: Set<string>;
  injuredIds?: Set<string>;
}): {
  players: Map<string, SelectionStatus>;
  starterCount: number;
  substituteCount: number;
  hasStarterSection: boolean;
  hasBenchSection: boolean;
  warnings: string[];
} {
  const warnings = [...params.detected.warnings];
  const playersById = new Map(params.players.map((p) => [p.id, p]));
  const suspendedIds = params.suspendedIds ?? new Set<string>();
  const injuredIds = params.injuredIds ?? new Set<string>();

  // 1. Cross-reference events (substitutions, goals, cards)
  const subsInIds = new Set<string>();
  const subsOutIds = new Set<string>();
  const inMatchActiveIds = new Set<string>();

  for (const ev of params.events) {
    let resolvedId = ev.playerId;
    if (!resolvedId) {
      for (const evName of [ev.playerName, ev.playerNameFr].filter((n): n is string => Boolean(n))) {
        const c = params.players.filter((p) => playerMatchesLine(evName, p));
        if (c.length === 1) {
          resolvedId = c[0]!.id;
          break;
        }
      }
    }
    if (resolvedId) {
      if (ev.type === "SUBSTITUTION_IN") {
        subsInIds.add(resolvedId);
      } else if (ev.type === "SUBSTITUTION_OUT") {
        subsOutIds.add(resolvedId);
      } else if (["GOAL", "PENALTY_GOAL", "YELLOW_CARD", "RED_CARD"].includes(ev.type)) {
        inMatchActiveIds.add(resolvedId);
      }
    }
  }

  // 2. Strict football rules:
  // - Any player who entered as a substitute (SUBSTITUTION_IN) started on the BENCH.
  // - Any player who was subbed OUT and was NOT subbed in, was a STARTER.
  // - Any player with in-match evidence (goals, bookings) who was NOT subbed in, was a STARTER.
  const trueSubstitutes = new Set<string>(subsInIds);
  const trueStarters = new Set<string>();

  for (const outId of subsOutIds) {
    if (!subsInIds.has(outId) && !suspendedIds.has(outId) && !injuredIds.has(outId)) {
      trueStarters.add(outId);
    }
  }

  for (const actId of inMatchActiveIds) {
    if (!subsInIds.has(actId) && !suspendedIds.has(actId) && !injuredIds.has(actId)) {
      trueStarters.add(actId);
    }
  }

  const resultPlayers = new Map<string, SelectionStatus>(params.detected.players);

  // Substituted-in players can NEVER be starting in the kickoff lineup
  for (const inId of trueSubstitutes) {
    resultPlayers.set(inId, "SUBSTITUTE");
  }

  // Confirmed starters MUST be starting
  for (const starterId of trueStarters) {
    resultPlayers.set(starterId, "STARTING");
  }

  // Goalkeeper handling: Exactly 1 starting GK
  let currentStarters = [...resultPlayers.entries()]
    .filter(([id, status]) => status === "STARTING" && !suspendedIds.has(id) && !injuredIds.has(id))
    .map(([id]) => id);

  const gkStarters = currentStarters.filter((id) => playersById.get(id)?.position === "GOALKEEPER");
  if (gkStarters.length > 1) {
    const primaryGk = gkStarters.find((id) => trueStarters.has(id) || id === params.officialCaptainId) ?? gkStarters[0]!;
    for (const gkId of gkStarters) {
      if (gkId !== primaryGk) {
        resultPlayers.set(gkId, "SUBSTITUTE");
      }
    }
    currentStarters = currentStarters.filter((id) => !gkStarters.includes(id) || id === primaryGk);
  }

  // If starters exceed 11:
  if (currentStarters.length > 11) {
    const prioritized = new Set<string>();
    // 1st: trueStarters with direct event proof
    for (const id of currentStarters) {
      if (trueStarters.has(id)) prioritized.add(id);
    }
    // 2nd: starting GK
    const startingGk = currentStarters.find((id) => playersById.get(id)?.position === "GOALKEEPER");
    if (startingGk) prioritized.add(startingGk);

    // 3rd: captain
    if (params.officialCaptainId && currentStarters.includes(params.officialCaptainId)) {
      prioritized.add(params.officialCaptainId);
    }

    // 4th: fill remaining slots up to 11 in document order
    for (const id of currentStarters) {
      if (prioritized.size >= 11) break;
      prioritized.add(id);
    }

    // Demote excess starters to SUBSTITUTE
    for (const id of currentStarters) {
      if (!prioritized.has(id)) {
        resultPlayers.set(id, "SUBSTITUTE");
      }
    }
  }

  const finalStarters = [...resultPlayers.entries()]
    .filter(([id, status]) => status === "STARTING" && !suspendedIds.has(id) && !injuredIds.has(id))
    .map(([id]) => id);
  const finalSubstitutes = [...resultPlayers.entries()]
    .filter(([, status]) => status === "SUBSTITUTE")
    .map(([id]) => id);

  const hasStarterSection = params.detected.hasStarterSection || finalStarters.length >= 7;
  const hasBenchSection = params.detected.hasBenchSection || finalSubstitutes.length > 0 || trueSubstitutes.size > 0;

  return {
    players: resultPlayers,
    starterCount: finalStarters.length,
    substituteCount: finalSubstitutes.length,
    hasStarterSection,
    hasBenchSection,
    warnings: [...new Set(warnings)]
  };
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
    select: { teamId: true, competitionId: true, matchDate: true, isHomeFixture: true, team: { select: { category: true } } }
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

  const warnings = [...detected.warnings];
  const existingLineups = await db.matchLineup.findMany({ where: { matchId }, select: { playerId: true, selectionStatus: true, shirtNumber: true, isCaptain: true } });
  const existingById = new Map(existingLineups.map((entry) => [entry.playerId, entry]));

  // Gather all events from DB and directly from document text
  const existingEvents = await db.matchEvent.findMany({
    where: { matchId },
    select: { type: true, playerId: true, playerName: true, playerNameFr: true }
  });

  const parsedFromText = parseReportDeterministically(text, players, { clubIsHome: match.isHomeFixture ?? true });
  const allEvents: PlayerEventSummary[] = [
    ...existingEvents.map((ev) => ({
      type: ev.type,
      playerId: ev.playerId,
      playerName: ev.playerName,
      playerNameFr: ev.playerNameFr
    })),
    ...parsedFromText.events.map((ev) => ({
      type: ev.type,
      playerId: ev.playerId,
      playerName: ev.playerName,
      playerNameFr: null,
      minute: ev.minute
    }))
  ];

  for (const player of players) {
    for (const rawLine of text.split(/[\r\n]+/u)) {
      if (playerMatchesLine(rawLine, player)) {
        if (/دخول|بديل\s+داخل|entrant|remplaçant\s+entrant/iu.test(rawLine)) {
          allEvents.push({ type: "SUBSTITUTION_IN", playerId: player.id });
        } else if (/خروج|مستبدل|sortant|joueur\s+sortant/iu.test(rawLine)) {
          allEvents.push({ type: "SUBSTITUTION_OUT", playerId: player.id });
        }
      }
    }
  }

  const injuredIds = new Set<string>();
  for (const player of players) {
    if (player.status === "INJURED" || existingById.get(player.id)?.selectionStatus === "INJURED") {
      injuredIds.add(player.id);
    }
  }

  const resolved = resolvePlayerSelections({
    detected,
    players,
    events: allEvents,
    officialCaptainId,
    suspendedIds,
    injuredIds
  });

  warnings.push(...resolved.warnings);

  const starterCount = resolved.starterCount;
  const substituteCount = resolved.substituteCount;
  const hasRosterStructure = detected.hasExplicitNotCalledSection || resolved.hasBenchSection || substituteCount > 0
    || (starterCount === 11);

  if (!resolved.hasStarterSection || !hasRosterStructure || starterCount < 7 || starterCount > 11) {
    if (!hasRosterStructure) warnings.push("لم يُتعرف على حدّ فاصل موثوق بين الأساسيين والاحتياط/غير المستدعين؛ لم تُغيّر حالات اللاعبين.");
    return {
      applied: false,
      starters: starterCount,
      substitutes: substituteCount,
      notCalled: 0,
      injured: 0,
      suspended: 0,
      untouched: players.length,
      warnings: [...new Set(warnings)],
      reason: "insufficient_recognition"
    };
  }

  const counts = { STARTING: 0, SUBSTITUTE: 0, NOT_CALLED: 0, INJURED: 0, SUSPENDED: 0 };
  const classifiedIds = new Set<string>();
  let restoredUnlistedPlayers = 0;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    if (officialCaptainId && resolved.players.get(officialCaptainId) === "STARTING") {
      await tx.matchLineup.updateMany({ where: { matchId, isCaptain: true, playerId: { not: officialCaptainId } }, data: { isCaptain: false } });
    }
    for (const player of players) {
      const detectedStatus = resolved.players.get(player.id);
      const existing = existingById.get(player.id);
      const existingStatus = existing?.selectionStatus;
      const isSuspended = suspendedIds.has(player.id);
      const isManuallyInjured = injuredIds.has(player.id);

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
        await tx.matchLineup.deleteMany({ where: { matchId, playerId: player.id } });
        restoredUnlistedPlayers++;
        continue;
      }

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

  if (!resolved.hasBenchSection) warnings.push("لم يُتعرف على قسم الاحتياط؛ تُرك اللاعبون غير المذكورين دون تغيير ليتم توزيعهم يدوياً.");
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
