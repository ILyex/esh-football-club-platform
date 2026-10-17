import "server-only";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { getFAFConfig } from "./config";
import { getFafEmsClient } from "./ems-client";
import { enqueueRefereeReportAnalysis } from "@/lib/ai/referee-report-job";
import { RetryableError } from "@/lib/jobs/types";
import { applyMatchSheetLineup } from "@/lib/matches/lineup-from-sheet";
import { extractDocumentText } from "@/lib/ai/document-verifier";
import { matchStadium } from "@/lib/matches/stadium";
import { extractFafRefereeCrew, isArabicRefereeName } from "./referee-crew";

export interface FafMatchSyncResult {
  success: boolean;
  matchId: string;
  message: string;
  refereeName?: string;
  matchSheetDocId?: string;
  refereeReportDocId?: string;
  warnings?: string[];
}

function normalize(value: unknown): string {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670]/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizedNameTokens(value: unknown): string {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .match(/[\p{L}\p{N}]+/gu)?.sort().join(" ") ?? "";
}

function samePersonName(left: unknown, right: unknown): boolean {
  const a = normalizedNameTokens(left);
  const leftKey = normalize(left);
  const rightKey = normalize(right);
  const genericNames = new Set(["لاعب", "لاعبغيرمحدد", "غيرمحدد"]);
  return a.length > 0 && !genericNames.has(leftKey) && !genericNames.has(rightKey) && a === normalizedNameTokens(right);
}

function remoteArray(match: any, keys: string[]): any[] {
  const records = [match, match?.events, match?.evenements, match?.matchEvents, match?.rencontre, match?.details]
    .filter((value) => value && typeof value === "object");
  let emptyArray: any[] | undefined;
  for (const record of records) {
    for (const key of keys) {
      if (!Array.isArray(record[key])) continue;
      if (record[key].length) return record[key];
      emptyArray ??= record[key];
    }
  }
  return emptyArray ?? [];
}

function remoteCards(match: any): any[] {
  const completeCards = remoteArray(match, ["cards", "cartons", "cardEvents"]);
  if (completeCards.length) return completeCards;
  return [
    ...remoteArray(match, ["yellowCards", "cartonsJaunes"]).map((card) => ({ ...card, cardColor: card.cardColor || "yellow" })),
    ...remoteArray(match, ["redCards", "cartonsRouges"]).map((card) => ({ ...card, cardColor: card.cardColor || "red" }))
  ];
}

function scoreValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99) return value;
  if (typeof value === "string" && /^\d{1,2}$/.test(value.trim())) return Number(value.trim());
  return null;
}

function officialScore(match: any, historyMatch: any, fallbackEvents: ImportedMatchEvent[]): { home: number; away: number } | null {
  const records = [match, match?.score, match?.resultat, historyMatch, historyMatch?.score, historyMatch?.resultat]
    .filter((value) => value && typeof value === "object");
  for (const record of records) {
    const home = scoreValue(record.scoreLoc ?? record.scoreLocal ?? record.homeScore ?? record.scoreHome ?? record.butsLoc ?? record.local ?? record.home);
    const away = scoreValue(record.scoreVis ?? record.scoreVisiteur ?? record.awayScore ?? record.scoreAway ?? record.butsVis ?? record.visiteur ?? record.away);
    if (home !== null && away !== null) return { home, away };
    const resultText = [record.resultat, record.score, record.result, record.scoreFinal].find((value) => typeof value === "string");
    const pair = typeof resultText === "string" ? resultText.match(/(?:^|\D)(\d{1,2})\s*[-–:]\s*(\d{1,2})(?:\D|$)/) : null;
    if (pair) return { home: Number(pair[1]), away: Number(pair[2]) };
  }
  const goals = fallbackEvents.filter((event) => ["GOAL", "PENALTY_GOAL", "OWN_GOAL"].includes(event.type));
  if (goals.length) return {
    home: goals.filter((event) => event.side === "HOME").length,
    away: goals.filter((event) => event.side === "AWAY").length
  };
  return null;
}

function dateKey(value: unknown): string {
  const localDate = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? "" : localDate(value);
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    // EMS sometimes returns a full UTC timestamp. Compare that instant in the
    // club's timezone, while keeping date-only and timezone-free values as
    // calendar dates (they are already expressed in local time by EMS).
    if (/T.*(?:Z|[+-]\d{2}:?\d{2})$/u.test(text)) {
      const timestamp = new Date(text);
      if (!Number.isNaN(timestamp.valueOf())) return localDate(timestamp);
    }
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const dmy = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (dmy) return `${dmy[3]!}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? "" : localDate(date);
}

function opponentName(club: any): string {
  return String(club?.nomAr || club?.denomination || club?.nomClub || club?.surnomAr || club?.surnom || "");
}

function remoteClubNames(club: any): string[] {
  return [opponentName(club), club?.nomFr, club?.nameFr, club?.nom, club?.name, club?.denomination]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
}

function namesMatch(local: string, remote: string): boolean {
  const variants = (value: string) => {
    const candidates = new Set([value, value.replace(/\s*\([^)]*\)/gu, "")]);
    for (const part of value.matchAll(/\(([^)]*)\)/gu)) if (part[1]) candidates.add(part[1]);
    for (const part of value.split(/[\/|]/u)) candidates.add(part);
    return [...candidates].map(normalize).filter((name) => name.length >= 4);
  };
  for (const a of variants(local)) {
    for (const b of variants(remote)) {
      if (a.includes(b) || b.includes(a)) return true;
      // Club names from local forms and FAF EMS can differ by one or two
      // letters. Keep fuzzy matching conservative and require a unique
      // candidate before accepting it below.
      if (Math.min(a.length, b.length) < 7) continue;
      let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
      for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
          current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        }
        previous = current;
      }
      if (1 - previous[b.length]! / Math.max(a.length, b.length) >= 0.72) return true;
    }
  }
  return false;
}

function eventSummary(events: ImportedMatchEvent[], match: { homeTeamName: string; awayTeamName: string }): string[] {
  const labels: Record<ImportedMatchEvent["type"], string> = {
    GOAL: "هدف", PENALTY_GOAL: "هدف من ركلة جزاء", OWN_GOAL: "هدف عكسي",
    YELLOW_CARD: "بطاقة صفراء", RED_CARD: "بطاقة حمراء",
    SUBSTITUTION_IN: "دخول بالتبديل", SUBSTITUTION_OUT: "خروج بالتبديل"
  };
  return events.filter((event) => event.side !== null).map((event) => {
    const teamName = event.side === "HOME" ? match.homeTeamName : match.awayTeamName;
    const playerName = event.playerName || event.playerNameFr || "لاعب غير محدد";
    return `${labels[event.type]} — ${playerName} — ${teamName} (${event.minute}')`;
  });
}

type ImportedMatchEvent = {
  fafExternalKey: string;
  type: "GOAL" | "PENALTY_GOAL" | "OWN_GOAL" | "YELLOW_CARD" | "RED_CARD" | "SUBSTITUTION_IN" | "SUBSTITUTION_OUT";
  side: "HOME" | "AWAY" | null;
  minute: number;
  playerId: string | null;
  playerName: string;
  playerNameFr: string;
  playerLicence: string;
  remoteLocSide: boolean | null;
  notes: string | null;
};

function playerFromRemoteEvent(entry: any): { name: string; nameFr: string; licence: string } {
  const person = entry?.player?.player?.personne || entry?.player?.personne
    || entry?.personne || entry?.person || entry?.player?.person || entry?.joueur?.personne || entry?.joueur?.person
    || entry?.joueur || entry?.athlete || entry?.player?.player || entry?.player;
  const arName = [person?.prenomAr || person?.firstNameAr || person?.givenNameAr, person?.nomAr || person?.lastNameAr || person?.familyNameAr]
    .filter((part) => typeof part === "string" && part.trim()).join(" ").trim();
  const frName = [person?.prenomFr || person?.firstNameFr || person?.firstName || person?.prenomArbitre || person?.prenom,
    person?.nomFr || person?.lastNameFr || person?.lastName || person?.nomArbitre || person?.nom]
    .filter((part) => typeof part === "string" && part.trim()).join(" ").trim();
  const directName = [entry?.playerNameAr || entry?.nomJoueurAr || entry?.nameAr, entry?.playerName || entry?.nomJoueur || entry?.name]
    .find((value) => typeof value === "string" && value.trim());
  const directNameIsArabic = typeof directName === "string" && /[\u0600-\u06FF]/u.test(directName);
  const name = arName || (directNameIsArabic ? String(directName).trim() : "") || frName || (typeof directName === "string" ? directName.trim() : "");
  const nameFr = frName || (typeof directName === "string" && !directNameIsArabic ? directName.trim() : "");
  const licence = entry?.licenceNumber || entry?.numeroLicence || entry?.numLicence
    || entry?.player?.licenceNumber || entry?.player?.numeroLicence
    || entry?.player?.player?.licenceNumber || entry?.player?.player?.numeroLicence
    || entry?.joueur?.licenceNumber || entry?.joueur?.numeroLicence || entry?.joueur?.numLicence
    || person?.licenceNumber || person?.numeroLicence || "";
  return { name, nameFr, licence: String(licence).trim() };
}

function sameImportedPerson(row: { playerName: string | null; playerNameFr?: string | null }, event: ImportedMatchEvent): boolean {
  return samePersonName(row.playerName, event.playerName)
    || samePersonName(row.playerName, event.playerNameFr)
    || samePersonName(row.playerNameFr, event.playerName)
    || samePersonName(row.playerNameFr, event.playerNameFr);
}

function eventMinute(value: unknown): number {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return eventMinute(record.minute ?? record.min ?? record.value ?? record.time ?? record.temps);
  }
  if (typeof value === "number") return Number.isFinite(value) ? Math.min(130, Math.max(0, Math.trunc(value))) : 0;
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?\s*(?:['’′]|min(?:ute)?s?|mn|د(?:قيقة)?)?$/iu)
    || text.match(/(?:^|\D)(\d{1,3})\s*\+\s*(\d{1,2})\s*(?:['’′]|min(?:ute)?s?|mn|د(?:قيقة)?)?(?:$|\D)/iu);
  if (!match) return 0;
  const minute = Number(match[1]) + Number(match[2] || 0);
  return Number.isFinite(minute) ? Math.min(130, Math.max(0, minute)) : 0;
}

function eventMinuteFrom(entry: any): number {
  const values = [entry?.minute, entry?.minuteMatch, entry?.minuteJeu, entry?.minuteEvenement, entry?.minuteBut,
    entry?.minuteCarton, entry?.minuteRemplacement, entry?.tempsBut, entry?.tempsCarton, entry?.tempsRemplacement,
    entry?.tempsJeu, entry?.temps, entry?.goalTime, entry?.cardTime, entry?.substitutionTime, entry?.time];
  const added = eventMinute(entry?.addedTime ?? entry?.additionalTime ?? entry?.tempsAdditionnel);
  for (const value of values) {
    const minute = eventMinute(value);
    if (minute > 0) return added > 0 && !String(value).includes("+") ? Math.min(130, minute + added) : minute;
  }
  return 0;
}

function remoteLocSideOf(entry: any, match: any, historyMatch: any, clubCode: string, remoteLocIsOurClub: boolean): boolean | null {
  const eventClubs = [entry?.club, entry?.team, entry?.equipe, entry?.clubEquipe, entry?.player?.club, entry?.player?.team,
    entry?.joueur?.club, entry?.joueur?.team, entry?.player?.player?.club, entry?.player?.player?.team]
    .filter((value) => value && typeof value === "object");
  const eventTeamCode = entry?.clubCode || entry?.fifaId || entry?.teamCode || entry?.codeFifa || entry?.club?.fifaId
    || entry?.team?.fifaId || entry?.equipe?.fifaId || entry?.clubEquipe?.fifaId || entry?.player?.club?.fifaId
    || entry?.player?.team?.fifaId || entry?.joueur?.club?.fifaId || entry?.joueur?.team?.fifaId
    || entry?.player?.player?.club?.fifaId || entry?.player?.player?.team?.fifaId
    || eventClubs.map((club) => club.codeFifa || club.code || club.fifaCode).find(Boolean)
    || [entry?.club, entry?.team, entry?.equipe, entry?.joueur?.club].find((value) => typeof value === "string");
  const eventClubId = entry?.clubId || entry?.teamId || entry?.equipeId || entry?.joueur?.clubId
    || eventClubs.map((club) => club.id || club.clubId).find(Boolean);
  const eventClubName = eventClubs.map((club) => club.nomAr || club.nomClub || club.denomination || club.nameAr || club.name || club.nom)
    .find((value) => typeof value === "string" && value.trim());
  const eventClubNameOrCode = eventClubName || [entry?.club, entry?.team, entry?.equipe, entry?.joueur?.club]
    .find((value) => typeof value === "string" && value.trim());
  const eventClubCode = String(eventTeamCode || "").toUpperCase();
  if (eventClubCode) {
    if (eventClubCode === String(clubCode || "").toUpperCase()) return remoteLocIsOurClub;
    const visitingCodes = [historyMatch?.clubVis?.fifaId, match?.clubVis?.fifaId]
      .filter(Boolean).map((value) => String(value).toUpperCase());
    const localHomeCodes = [historyMatch?.clubLoc?.fifaId, match?.clubLoc?.fifaId]
      .filter(Boolean).map((value) => String(value).toUpperCase());
    if (localHomeCodes.includes(eventClubCode)) return true;
    if (visitingCodes.includes(eventClubCode)) return false;
  }
  const localClubIds = [historyMatch?.clubLoc?.id, match?.clubLoc?.id].filter(Boolean).map(String);
  const visitingClubIds = [historyMatch?.clubVis?.id, match?.clubVis?.id].filter(Boolean).map(String);
  if (eventClubId && localClubIds.includes(String(eventClubId))) return true;
  if (eventClubId && visitingClubIds.includes(String(eventClubId))) return false;
  if (typeof eventClubNameOrCode === "string") {
    const localNames = [historyMatch?.clubLoc, match?.clubLoc].flatMap(remoteClubNames);
    const visitingNames = [historyMatch?.clubVis, match?.clubVis].flatMap(remoteClubNames);
    const isLoc = localNames.some((name) => namesMatch(name, eventClubNameOrCode));
    const isVis = visitingNames.some((name) => namesMatch(name, eventClubNameOrCode));
    if (isLoc !== isVis) return isLoc;
  }
  const side = String(entry?.teamSide || entry?.side || entry?.teamType || "").toLowerCase();
  if (/loc|home|domicile|محلي|مضيف/.test(side)) return true;
  if (/vis|away|extérieur|ضيف/.test(side)) return false;
  if (typeof entry?.isHome === "boolean") return entry.isHome;
  if (typeof entry?.isLocal === "boolean") return entry.isLocal;
  if (typeof entry?.isAway === "boolean") return !entry.isAway;
  if (typeof entry?.isVisiteur === "boolean") return !entry.isVisiteur;
  return null;
}

function remoteMatchEvents(match: any, externalId: number, remoteLocIsOurClub: boolean, localClubIsHome: boolean, historyMatch: any, clubCode: string, warnings: string[] = []): ImportedMatchEvent[] {
  const output: ImportedMatchEvent[] = [];
  const keys = new Map<string, number>();
  let missingMinuteEvents = 0;
  const localSide: "HOME" | "AWAY" = localClubIsHome ? "HOME" : "AWAY";
  const opponentSide: "HOME" | "AWAY" = localClubIsHome ? "AWAY" : "HOME";
  const sideFor = (isRemoteLocEvent: boolean): "HOME" | "AWAY" =>
    isRemoteLocEvent === remoteLocIsOurClub ? localSide : opponentSide;
  const add = (raw: any, type: ImportedMatchEvent["type"], remoteLocSide: boolean | null, label: string, nameOverride?: string, minuteOverride?: number) => {
    // Match staff cards are intentionally excluded from player match events.
    if (raw?.staff || raw?.staffMember || raw?.coach || raw?.encadreur) return;
    const player = playerFromRemoteEvent(raw);
    if (!nameOverride && !player.name && !player.licence) return;
    const playerName = nameOverride || player.name || `لاعب (${player.licence})`;
    const minute = minuteOverride ?? eventMinuteFrom(raw);
    if (minute < 1) {
      missingMinuteEvents++;
      return;
    }
    let side = remoteLocSide == null ? null : sideFor(remoteLocSide);
    if (side && type === "OWN_GOAL") side = side === "HOME" ? "AWAY" : "HOME";
    const identity = `${type}|${side || "unknown"}|${minute}|${player.licence || normalize(playerName)}`;
    const occurrence = keys.get(identity) ?? 0;
    keys.set(identity, occurrence + 1);
    output.push({
      fafExternalKey: `faf:${externalId}:${identity}:${occurrence}`,
      type, side, minute, playerId: null, playerName, playerNameFr: player.nameFr, playerLicence: player.licence, remoteLocSide,
      // Card reasons are intentionally omitted from the public match timeline.
      notes: label
    });
  };

  for (const card of remoteCards(match)) {
    const color = String(card.cardColor || card.color || "").toLocaleLowerCase("ar");
    const type = /red|rouge|حمراء|حمرا/.test(color) || match.redCards?.includes?.(card) ? "RED_CARD" : "YELLOW_CARD";
    const isLoc = remoteLocSideOf(card, match, historyMatch, clubCode, remoteLocIsOurClub);
    add(card, type, isLoc, type === "RED_CARD" ? "بطاقة حمراء" : "بطاقة صفراء");
  }
  for (const goal of remoteArray(match, ["goals", "buts", "goalEvents", "scorers"])) {
    const isLoc = remoteLocSideOf(goal, match, historyMatch, clubCode, remoteLocIsOurClub);
    const ownGoal = Boolean(goal.isOwnGoal || goal.ownGoal || /own|contre son camp|ذاتي/.test(String(goal.type || goal.goalType || "").toLowerCase()));
    const penalty = Boolean(goal.isPenalty || goal.penalty || /penalty|penalty_goal|جزاء/.test(String(goal.type || goal.goalType || "").toLowerCase()));
    add(goal, ownGoal ? "OWN_GOAL" : penalty ? "PENALTY_GOAL" : "GOAL", isLoc, ownGoal ? "هدف عكسي" : penalty ? "هدف من ركلة جزاء" : "هدف");
  }
  for (const substitution of remoteArray(match, ["substitution", "substitutions", "substitutionEvents", "remplacements"])) {
    const isLoc = remoteLocSideOf(substitution, match, historyMatch, clubCode, remoteLocIsOurClub);
    const outPlayer = substitution.outPlayer || substitution.playerOut || substitution.playerSortant;
    const inPlayer = substitution.inPlayer || substitution.playerIn || substitution.playerEntrant;
    const minute = eventMinuteFrom(substitution);
    if (outPlayer) add(outPlayer, "SUBSTITUTION_OUT", remoteLocSideOf(outPlayer, match, historyMatch, clubCode, remoteLocIsOurClub) ?? isLoc, "خروج بالتبديل", undefined, minute);
    if (inPlayer) add(inPlayer, "SUBSTITUTION_IN", remoteLocSideOf(inPlayer, match, historyMatch, clubCode, remoteLocIsOurClub) ?? isLoc, "دخول بالتبديل", undefined, minute);
  }
  if (missingMinuteEvents) warnings.push(`تُرك ${missingMinuteEvents} أحداث دون استيراد لأن وثيقة FAF EMS لا تحتوي على دقيقة موثوقة لها.`);
  return output;
}

async function reconcilePlayerEvents(matchId: string, teamId: string | null, imported: ImportedMatchEvent[], localClubIsHome: boolean, remoteLocIsOurClub: boolean, warnings: string[]): Promise<number> {
  if (!imported.length) return 0;

  let eligibleTeamIds = teamId ? [teamId] : [];
  if (teamId) {
    const team = await db.team.findUnique({ where: { id: teamId }, select: { category: true } });
    if (team?.category === "SENIOR") {
      const u20 = await db.team.findUnique({ where: { category: "U20" }, select: { id: true } });
      if (u20?.id) eligibleTeamIds.push(u20.id);
    }
  }
  const players = eligibleTeamIds.length ? await db.player.findMany({
    where: { teamId: { in: eligibleTeamIds }, status: { not: "ARCHIVED" } },
    select: { id: true, firstName: true, lastName: true, firstNameFr: true, lastNameFr: true, licenceNumber: true }
  }) : [];
  const byLicence = new Map<string, typeof players>();
  for (const player of players) {
    if (!player.licenceNumber) continue;
    const key = normalize(player.licenceNumber);
    byLicence.set(key, [...(byLicence.get(key) ?? []), player]);
  }
  const resolvePlayer = (event: ImportedMatchEvent) => {
    const licenceCandidates = event.playerLicence ? byLicence.get(normalize(event.playerLicence)) ?? [] : [];
    if (licenceCandidates.length === 1) return { player: licenceCandidates[0], ambiguous: false };
    if (licenceCandidates.length > 1) return { player: undefined, ambiguous: true };

    const eventNames = [event.playerName, event.playerNameFr].map(normalizedNameTokens).filter(Boolean);
    if (!eventNames.length) return { player: undefined, ambiguous: false };
    const candidates = players.filter((player) => {
      const names = [
        `${player.firstName} ${player.lastName}`,
        `${player.lastName} ${player.firstName}`,
        player.firstNameFr && player.lastNameFr ? `${player.firstNameFr} ${player.lastNameFr}` : "",
        player.firstNameFr && player.lastNameFr ? `${player.lastNameFr} ${player.firstNameFr}` : ""
      ];
      return names.some((name) => eventNames.includes(normalizedNameTokens(name)));
    });
    return { player: candidates.length === 1 ? candidates[0] : undefined, ambiguous: candidates.length > 1 };
  };
  let unresolvedTeamEvents = 0;
  let unlinkedLocalPlayerEvents = 0;
  for (const event of imported) {
    const resolved = resolvePlayer(event);
    const player = resolved.player;
    const localSide = localClubIsHome ? "HOME" : "AWAY";
    if (event.side == null) {
      if (player) event.side = event.type === "OWN_GOAL" ? (localSide === "HOME" ? "AWAY" : "HOME") : localSide;
      else {
        unresolvedTeamEvents++;
        continue;
      }
    }
    const actorIsLocal = event.remoteLocSide == null ? Boolean(player) : event.remoteLocSide === remoteLocIsOurClub;
    event.playerId = actorIsLocal ? player?.id ?? null : null;
    if (actorIsLocal && !player) unlinkedLocalPlayerEvents++;
  }
  if (unresolvedTeamEvents) {
    warnings.push(`لم أُسند ${unresolvedTeamEvents} أحداث إلى أي فريق لأن بيانات FAF EMS لم تحدد الجهة ولم أجد اللاعب في سجل المنصة. أضف لاعبي الفئة ثم أعد جلب الوثائق.`);
  }
  if (unlinkedLocalPlayerEvents) {
    warnings.push(`حُفظ ${unlinkedLocalPlayerEvents} أحداث باسم اللاعب وجهة فريقه، لكن لم تُربط بملفه لعدم وجوده في سجل لاعبي الفئة. أضف اللاعبين ثم أعد جلب الوثائق لإكمال الإحصائيات.`);
  }

  const existing = await db.matchEvent.findMany({
    where: { matchId },
    select: { id: true, type: true, side: true, minute: true, playerId: true, playerName: true, playerNameFr: true, source: true }
  });
  // Earlier imports could save a card under its display name without linking
  // it to the local player. Repair those rows during reconciliation before
  // duplicate detection prevents them from being imported again.
  let repairedCount = 0;
  const repairedIds = new Set<string>();
  for (const event of imported) {
    if (event.side == null) continue;
    const importedRows = existing.filter((row) => row.source === "REFEREE_REPORT" && row.type === event.type
      && !repairedIds.has(row.id) && sameImportedPerson(row, event));
    const exactMinuteRows = importedRows.filter((row) => row.minute === event.minute);
    const nearestRows = importedRows.filter((row) => Math.abs(row.minute - event.minute) <= 6)
      .sort((left, right) => Math.abs(left.minute - event.minute) - Math.abs(right.minute - event.minute));
    const importedRow = exactMinuteRows.length === 1 ? exactMinuteRows[0]
      : importedRows.length === 1 ? importedRows[0]
      : nearestRows.length === 1 || (nearestRows.length > 1 && Math.abs(nearestRows[0]!.minute - event.minute) < Math.abs(nearestRows[1]!.minute - event.minute))
        ? nearestRows[0]
        : undefined;
    if (importedRow) {
      if (importedRow.side !== event.side || importedRow.playerId !== event.playerId || importedRow.playerName !== event.playerName
        || importedRow.playerNameFr !== event.playerNameFr || importedRow.minute !== event.minute) {
        await db.matchEvent.update({
          where: { id: importedRow.id },
          data: { side: event.side, playerId: event.playerId, playerName: event.playerName, playerNameFr: event.playerNameFr || null, minute: event.minute }
        });
        importedRow.side = event.side;
        importedRow.playerId = event.playerId;
        importedRow.playerName = event.playerName;
        importedRow.playerNameFr = event.playerNameFr || null;
        importedRow.minute = event.minute;
        repairedCount++;
      }
      repairedIds.add(importedRow.id);
      continue;
    }
    if (!event.playerId) continue;
    const unlinked = existing.filter((row) => !row.playerId && row.type === event.type && row.minute === event.minute
      && (row.side === event.side || row.source === "REFEREE_REPORT")
      && sameImportedPerson(row, event));
    if (unlinked.length === 1) {
      const linked = await db.matchEvent.updateMany({
        where: { id: unlinked[0]!.id, playerId: null },
        data: { playerId: event.playerId, playerName: event.playerName, playerNameFr: event.playerNameFr || null, side: event.side, source: "REFEREE_REPORT" }
      });
      if (linked.count === 1) {
        unlinked[0]!.playerId = event.playerId;
        unlinked[0]!.side = event.side;
        unlinked[0]!.playerName = event.playerName;
        unlinked[0]!.playerNameFr = event.playerNameFr || null;
        repairedIds.add(unlinked[0]!.id);
        repairedCount++;
      }
    }
  }
  const pendingFresh = imported.filter((event) => event.side !== null && !existing.some((row) => row.type === event.type && row.side === event.side && row.minute === event.minute
    && ((event.playerId && row.playerId === event.playerId) || sameImportedPerson(row, event))));
  if (!pendingFresh.length) return repairedCount;
  const created = await db.matchEvent.createMany({
    data: pendingFresh.map((event) => ({
      matchId,
      fafExternalKey: event.fafExternalKey,
      type: event.type,
      side: event.side!,
      minute: event.minute,
      playerId: event.playerId,
      playerName: event.playerName,
      playerNameFr: event.playerNameFr || null,
      notes: event.notes,
      source: "REFEREE_REPORT" as const
    })),
    skipDuplicates: true
  });
  return repairedCount + created.count;
}

async function resolveLocalMatch(matchId: string, clubCode: string) {
  const local = await db.match.findUnique({ where: { id: matchId }, include: { team: true } });
  if (!local) throw new Error("Match not found");
  const remoteMatches = await getFafEmsClient().history();
  const scheduledMappings = await db.integrationState.findMany({
    where: { OR: [
      { key: { startsWith: "faf-ems-scheduled-match:" } },
      { key: { startsWith: "faf-ems-match-" } }
    ] },
    select: { key: true, value: true }
  });
  const mappedExternalIds = scheduledMappings.flatMap((mapping) => {
    try {
      const value = JSON.parse(mapping.value) as { matchId?: string };
      const prefix = mapping.key.startsWith("faf-ems-scheduled-match:") ? "faf-ems-scheduled-match:" : "faf-ems-match-";
      const externalId = Number(mapping.key.slice(prefix.length));
      return value.matchId === local.id && Number.isSafeInteger(externalId) ? [externalId] : [];
    } catch {
      return [];
    }
  });
  for (const externalId of mappedExternalIds) {
    const mapped = remoteMatches.find((remote) => Number(remote.id) === externalId);
    if (!mapped) continue;
    const ourRemoteClub = local.isHomeFixture ? mapped.clubLoc : mapped.clubVis;
    if (String(ourRemoteClub?.fifaId || "").toUpperCase() === clubCode.toUpperCase()) {
      return { local, remote: mapped };
    }
  }
  const localDate = dateKey(local.matchDate);
  const candidates = remoteMatches.filter((remote) => {
    if (dateKey(remote.dateRencontre) !== localDate) return false;
    const localClub = local.isHomeFixture ? remote.clubLoc : remote.clubVis;
    const otherClub = local.isHomeFixture ? remote.clubVis : remote.clubLoc;
    if (String(localClub?.fifaId || "").toUpperCase() !== clubCode.toUpperCase()) return false;
    const localOpponent = local.isHomeFixture ? local.awayTeamName : local.homeTeamName;
    return namesMatch(localOpponent, opponentName(otherClub));
  });
  if (candidates.length !== 1) {
    throw new Error(candidates.length
      ? "وجدت أكثر من مباراة محتملة في EMS في نفس التاريخ؛ لم أستورد أي بيانات لتجنب ربط مباراة خاطئة."
      : "حُفظت المباراة في المنصة، لكن تعذّر ربطها بمباراة FAF EMS. تحقق من تاريخ المباراة واسم المنافس أو استورد المباراة المبرمجة أولاً.");
  }
  return { local, remote: candidates[0] };
}

export async function syncFafMatchDocuments(matchId: string, userId?: string): Promise<FafMatchSyncResult> {
  const config = getFAFConfig();
  // Do not gate on environment credentials here: FafEmsClient first checks the
  // encrypted, persisted FAF session (PostgreSQL on Vercel). Requiring env vars
  // before that lookup made valid stored sessions unusable in production.
  if (!config.enabled) throw new Error("FAF EMS integration is disabled on the server.");
  const { local, remote } = await resolveLocalMatch(matchId, config.clubCode);
  if (!remote) throw new Error("No matching FAF EMS record was found.");
  const actorId = userId || (await db.user.findFirst({ where: { role: { key: "ADMIN" } }, select: { id: true } }))?.id;
  if (!actorId) throw new Error("A platform user is required to attach imported FAF documents.");
  const externalId = Number(remote.id);
  const api = getFafEmsClient();
  const [detailsResult, firstReportResult, finalReportResult] = await Promise.allSettled([
    api.matchInfo(externalId),
    api.report(externalId, "first-report-ar"),
    api.report(externalId, "final-report-ar")
  ]);
  if (detailsResult.status === "rejected") throw detailsResult.reason;
  const official = detailsResult.value.match;
  const reportResults = [firstReportResult, finalReportResult];
  const temporaryReportFailure = reportResults.find((result) => result.status === "rejected" && result.reason instanceof RetryableError);
  if (temporaryReportFailure?.status === "rejected") {
    throw new RetryableError("FAF EMS temporarily failed to return a report document; the complete import will retry safely.", temporaryReportFailure.reason);
  }

  const { validateUploadedFile, uploadPrivateFile, generateStorageKey, getPrivateFileBuffer, deletePrivateFile } = await import("@/lib/storage");
  const documentSpecs = [
    { kind: "PRE_MATCH_SHEET" as const, label: "first-report-ar", title: "وثيقة بداية المباراة", bytes: firstReportResult.status === "fulfilled" ? firstReportResult.value : null },
    { kind: "REFEREE_REPORT" as const, label: "final-report-ar", title: "تقرير المباراة النهائي", bytes: finalReportResult.status === "fulfilled" ? finalReportResult.value : null }
  ];
  const warnings: string[] = [];
  let refereeReportText: string | null = null;
  const finalReportBytes = documentSpecs.find((item) => item.kind === "REFEREE_REPORT")?.bytes;
  if (finalReportBytes) {
    try {
      refereeReportText = (await extractDocumentText(finalReportBytes, "application/pdf"))?.trim().slice(0, 5000) || null;
      if (!refereeReportText) warnings.push("حُفظ التقرير النهائي، لكن لم يُستخرج منه نص قابل للتحليل الآلي.");
    } catch (error) {
      console.warn("[FAF EMS] Referee report text extraction failed", error);
      warnings.push("حُفظ التقرير النهائي، لكن تعذر استخراج نصه للتحليل الآلي.");
    }
  }
  if (firstReportResult.status === "rejected") warnings.push(`تعذر جلب وثيقة بداية المباراة: ${firstReportResult.reason instanceof Error ? firstReportResult.reason.message : "خطأ غير معروف"}`);
  if (finalReportResult.status === "rejected") warnings.push(`تعذر جلب التقرير النهائي: ${finalReportResult.reason instanceof Error ? finalReportResult.reason.message : "خطأ غير معروف"}`);
  const hasDocumentsToImport = documentSpecs.some((item) => item.bytes);
  const category = hasDocumentsToImport
    ? await db.documentCategory.upsert({
        where: { key: "report" },
        update: {},
        create: { key: "report", name: "Reports" }
      })
    : null;
  const documentIdsByKind = new Map<string, string>();
  let importedDocuments = 0;
  let refreshedDocuments = 0;
  for (const item of documentSpecs) {
    const originalName = `FAF-EMS-${externalId}-${item.label}.pdf`;
    const existing = await db.document.findFirst({ where: { relatedMatchId: local.id, originalName }, select: { id: true, storageKey: true } });
    if (existing && item.bytes) {
      let unchanged = false;
      try { unchanged = (await getPrivateFileBuffer(existing.storageKey)).equals(item.bytes); }
      catch { /* A missing/legacy local object is repaired from the authoritative FAF copy below. */ }
      if (!unchanged) {
        const validation = await validateUploadedFile(item.bytes);
        const storageKey = generateStorageKey("faf-ems", validation.ext);
        await uploadPrivateFile({ key: storageKey, buffer: item.bytes, mimeType: validation.mime });
        await db.document.update({
          where: { id: existing.id },
          data: { storageKey, mimeType: validation.mime, sizeBytes: item.bytes.byteLength }
        });
        await deletePrivateFile(existing.storageKey).catch(() => undefined);
        refreshedDocuments++;
      }
      documentIdsByKind.set(item.kind, existing.id);
      continue;
    }
    if (existing) { documentIdsByKind.set(item.kind, existing.id); continue; }
    if (!item.bytes || !category) continue;
    const validation = await validateUploadedFile(item.bytes);
    const storageKey = generateStorageKey("faf-ems", validation.ext);
    await uploadPrivateFile({ key: storageKey, buffer: item.bytes, mimeType: validation.mime });
    const created = await db.document.create({
      data: {
        name: `${item.title} — ${local.homeTeamName} ضد ${local.awayTeamName}`,
        categoryId: category.id,
        description: `مستوردة مباشرة من FAF EMS للمباراة ${externalId}.`,
        documentDate: local.matchDate,
        classification: "INTERNAL",
        status: "PENDING_REVIEW",
        matchDocumentType: item.kind,
        storageKey,
        mimeType: validation.mime,
        sizeBytes: item.bytes.byteLength,
        originalName,
        ownerId: actorId,
        uploadedById: actorId,
        relatedMatchId: local.id,
        teamId: local.teamId
      }
    });
    documentIdsByKind.set(item.kind, created.id);
    importedDocuments++;
  }

  let lineupSummary: Awaited<ReturnType<typeof applyMatchSheetLineup>> | undefined;
  const matchSheet = documentSpecs.find((item) => item.kind === "PRE_MATCH_SHEET");
  if (matchSheet?.bytes && local.teamId) {
    try {
      const sheetText = await extractDocumentText(matchSheet.bytes, "application/pdf");
      if (sheetText) {
        lineupSummary = await applyMatchSheetLineup(local.id, local.teamId, sheetText);
        if (!lineupSummary.applied) {
          warnings.push("حُفظت وثيقة المباراة، لكن لم تكن بيانات التشكيلة المقروءة كافية لتعديل قائمة اللاعبين.");
        }
      } else {
        warnings.push("حُفظت وثيقة المباراة، لكن تعذرت قراءة الأسماء تلقائياً؛ لم يتم تغيير قائمة اللاعبين.");
      }
    } catch (error) {
      console.warn("[FAF EMS] Match sheet lineup extraction failed", error);
      warnings.push("حُفظت وثيقة المباراة، لكن تعذر استخراج قائمة اللاعبين منها؛ لم يتم تغيير القائمة.");
    }
  }

  const refereeReportDocumentId = documentIdsByKind.get("REFEREE_REPORT");

  const refereeCrew = extractFafRefereeCrew(official, remote);
  const refereeNameAr = refereeCrew.ar.join("، ") || null;
  const refereeNameFr = refereeCrew.fr.join(", ") || null;
  const referee = refereeCrew.fr[0] || refereeCrew.ar[0] || null;
  const previousArabicRefereeNames = local.refereeNameAr === local.refereeName && !isArabicRefereeName(local.refereeNameAr)
    ? null
    : local.refereeNameAr;
  // resolveLocalMatch matched the fixture against Historique using the club's
  // configured FIFA id and the local home/away orientation. Treat that match
  // orientation as the source of truth; detail responses can omit/change IDs.
  const remoteLocIsOurClub = local.isHomeFixture;
  const importedEvents = remoteMatchEvents(official, externalId, remoteLocIsOurClub, local.isHomeFixture, remote, config.clubCode, warnings);
  const importedEventCount = await reconcilePlayerEvents(
    local.id,
    local.teamId,
    importedEvents,
    local.isHomeFixture,
    remoteLocIsOurClub,
    warnings
  );
  // Publish only events whose side was identified from EMS or an unambiguous
  // local player match. Never turn an unresolved event into an opponent event.
  const events = eventSummary(importedEvents, local);
  const reportText = events.length ? `مجريات المباراة من FAF EMS:\n${events.join("\n")}` : "";
  const officialStatus = String(official.status || official.matchStatus || official.etatRencontre || "").toLocaleLowerCase("ar");
  const explicitlyFinished = /finished|termin|jouee|joué|clotur|final|انتهت|منتهية|نهائي/.test(officialStatus)
    || finalReportResult.status === "fulfilled";
  const explicitlyLive = /live|en cours|مباشر|جارية/.test(officialStatus);
  const officialResult = officialScore(official, remote, importedEvents);
  await db.match.update({
    where: { id: local.id },
    data: {
      ...(officialResult ? { homeScore: officialResult.home, awayScore: officialResult.away } : {}),
      stadium: matchStadium(local.isHomeFixture, official.stade?.nomAr || official.stade?.nomStade, local.stadium),
      refereeName: referee || local.refereeName,
      refereeNameAr: refereeNameAr || previousArabicRefereeNames,
      refereeNameFr: refereeNameFr || local.refereeNameFr,
      matchReport: reportText || local.matchReport,
      ...(explicitlyFinished ? { status: "FINISHED" as const } : explicitlyLive ? { status: "LIVE" as const } : {})
    }
  });
  let analysisMessage = "";
  if (refereeReportDocumentId && refereeReportText) {
    // The report bytes came directly from FAF EMS in this request. Pass the
    // extracted text to the job so analysis does not depend on a cross-function
    // object-storage read immediately after the document was uploaded.
    // Queue only after imported player events exist, so duplicate detection
    // sees this reconciliation pass before it creates events.
    await enqueueRefereeReportAnalysis(db, {
      matchId: local.id,
      documentId: refereeReportDocumentId,
      reportText: refereeReportText,
      userId: actorId
    });
    analysisMessage = " أُضيف تحليل أحداث التقرير إلى قائمة المهام الخلفية.";
  }
  await db.integrationState.upsert({
    where: { key: `faf-ems-match-${externalId}` },
    create: { key: `faf-ems-match-${externalId}`, value: JSON.stringify({ matchId: local.id, syncedAt: new Date().toISOString() }) },
    update: { value: JSON.stringify({ matchId: local.id, syncedAt: new Date().toISOString() }) }
  });
  revalidatePath("/[locale]/dashboard/matches", "page");
  revalidatePath("/[locale]/dashboard/matches/[id]", "page");
  revalidatePath("/[locale]/dashboard/players", "page");
  revalidatePath("/[locale]/dashboard/player-stats", "page");
  revalidatePath("/[locale]/matches", "page");
  revalidatePath("/[locale]", "page");
  await writeAuditLog({ userId: actorId, action: "FAF_MATCH_SYNC_COMPLETED", entityType: "Match", entityId: local.id, changes: { externalId, importedDocuments, eventCount: events.length, importedEventCount, lineupSummary, warnings } });
  const lineupMessage = lineupSummary?.applied
    ? ` تم تحديث قائمة المباراة تلقائياً: ${lineupSummary.starters} أساسي، ${lineupSummary.substitutes} احتياط، ${lineupSummary.notCalled} غير مدعو، ${lineupSummary.injured} مصاب يدوياً، ${lineupSummary.suspended} موقوف.`
    : "";
  return {
    success: true,
    matchId: local.id,
    message: `تمت مزامنة تفاصيل المباراة من FAF EMS وحفظ ${importedDocuments} مستندات جديدة وتحديث ${refreshedDocuments} مستندات وإضافة ${importedEventCount} حدث جديد دون تكرار الموجود.${lineupMessage}${analysisMessage}${warnings.length ? ` ${warnings.join(" ")}` : ""}`,
    refereeName: referee || undefined,
    matchSheetDocId: documentIdsByKind.get("PRE_MATCH_SHEET"),
    refereeReportDocId: refereeReportDocumentId,
    warnings
  };
}
