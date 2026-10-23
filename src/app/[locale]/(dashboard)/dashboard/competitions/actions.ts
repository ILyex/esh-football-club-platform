"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { competitionSchema } from "@/lib/validations/competition";
import { seasonSchema } from "@/lib/validations/season";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rankStandings } from "@/lib/competitions/standings";
import { Prisma } from "@prisma/client";

const standingEntrySchema = z.object({
  id: z.string().min(1).max(120),
  rank: z.number().int().positive(),
  teamName: z.string().trim().min(2).max(120),
  teamLogo: z.string().max(2048).nullable().optional(),
  isOurClub: z.boolean(),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  drawn: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  goalsFor: z.number().int().nonnegative(),
  goalsAgainst: z.number().int().nonnegative(),
  goalDifference: z.number().int(),
  points: z.number().int(),
  pointsAdjustment: z.number().int().max(0).optional(),
  baselineAt: z.string().datetime().optional(),
  form: z.array(z.enum(["W", "D", "L"])).max(5).optional()
}).superRefine((team, ctx) => {
  if (team.played !== team.won + team.drawn + team.lost) ctx.addIssue({ code: "custom", message: "played must equal wins + draws + losses" });
  if (team.points !== team.won * 3 + team.drawn + (team.pointsAdjustment ?? 0)) ctx.addIssue({ code: "custom", message: "points must use the 3-1-0 system with listed deductions" });
  if (team.goalDifference !== team.goalsFor - team.goalsAgainst) ctx.addIssue({ code: "custom", message: "goal difference must match goals for and against" });
});

const standingsSchema = z.array(standingEntrySchema).max(100).superRefine((teams, ctx) => {
  const names = new Set<string>();
  const ids = new Set<string>();
  let ourClubCount = 0;
  teams.forEach((team, index) => {
    const key = team.teamName.toLocaleLowerCase();
    if (names.has(key)) ctx.addIssue({ code: "custom", path: [index, "teamName"], message: "Duplicate team name" });
    names.add(key);
    if (ids.has(team.id)) ctx.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate row id" });
    ids.add(team.id);
    if (team.isOurClub) ourClubCount += 1;
  });
  if (ourClubCount > 1) ctx.addIssue({ code: "custom", message: "Only one row may represent the club" });
});

const bracketMatchSchema = z.object({
  id: z.string().min(1).max(120),
  round: z.enum(["ROUND_OF_16", "QUARTER_FINAL", "SEMI_FINAL", "FINAL"]),
  matchOrder: z.number().int().positive(),
  homeTeam: z.object({ name: z.string().max(120), logo: z.string().max(2048).nullable().optional(), score: z.number().int().nonnegative().nullable().optional(), penalties: z.number().int().nonnegative().nullable().optional(), isOurClub: z.boolean().optional() }),
  awayTeam: z.object({ name: z.string().max(120), logo: z.string().max(2048).nullable().optional(), score: z.number().int().nonnegative().nullable().optional(), penalties: z.number().int().nonnegative().nullable().optional(), isOurClub: z.boolean().optional() }),
  winner: z.enum(["HOME", "AWAY"]).nullable().optional(),
  status: z.enum(["SCHEDULED", "LIVE", "FINISHED"]),
  date: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional()
}).superRefine((match, ctx) => {
  const homePenalty = match.homeTeam.penalties;
  const awayPenalty = match.awayTeam.penalties;
  if ((homePenalty == null) !== (awayPenalty == null)) ctx.addIssue({ code: "custom", message: "Both teams must have a penalty score" });
  if (homePenalty != null && awayPenalty != null && (match.homeTeam.score == null || match.awayTeam.score == null || match.homeTeam.score !== match.awayTeam.score)) {
    ctx.addIssue({ code: "custom", message: "Penalty scores are only valid when the match is tied" });
  }
  if (match.status === "FINISHED" && !match.winner) ctx.addIssue({ code: "custom", message: "A finished knockout match requires a winner" });
  if (match.winner) {
    if (match.status !== "FINISHED" || match.homeTeam.score == null || match.awayTeam.score == null) {
      ctx.addIssue({ code: "custom", message: "A winner requires a finished match with both scores" });
    } else {
      const expectedWinner = match.homeTeam.score > match.awayTeam.score ? "HOME" : match.homeTeam.score < match.awayTeam.score ? "AWAY" :
        homePenalty != null && awayPenalty != null && homePenalty !== awayPenalty ? homePenalty > awayPenalty ? "HOME" : "AWAY" : null;
      if (match.winner !== expectedWinner) ctx.addIssue({ code: "custom", message: "Winner does not match the score or penalty result" });
    }
  }
});
const bracketSchema = z.object({
  rounds: z.array(z.object({
    roundKey: z.enum(["ROUND_OF_16", "QUARTER_FINAL", "SEMI_FINAL", "FINAL"]),
    labelAr: z.string().trim().min(1).max(80),
    labelFr: z.string().trim().min(1).max(80),
    matches: z.array(bracketMatchSchema).max(32)
  })).max(4)
}).superRefine((bracket, ctx) => {
  const roundKeys = new Set<string>();
  const matchIds = new Set<string>();
  bracket.rounds.forEach((round, roundIndex) => {
    if (roundKeys.has(round.roundKey)) ctx.addIssue({ code: "custom", path: ["rounds", roundIndex], message: "Duplicate round" });
    roundKeys.add(round.roundKey);
    const orders = new Set<number>();
    round.matches.forEach((match, matchIndex) => {
      if (match.round !== round.roundKey) ctx.addIssue({ code: "custom", path: ["rounds", roundIndex, "matches", matchIndex, "round"], message: "Match must belong to its containing round" });
      if (matchIds.has(match.id)) ctx.addIssue({ code: "custom", path: ["rounds", roundIndex, "matches", matchIndex, "id"], message: "Duplicate match id" });
      matchIds.add(match.id);
      if (orders.has(match.matchOrder)) ctx.addIssue({ code: "custom", path: ["rounds", roundIndex, "matches", matchIndex, "matchOrder"], message: "Duplicate match order in round" });
      orders.add(match.matchOrder);
    });
  });
});

// Seasons are a supporting entity for Competitions/Calendar/Statistics
// (spec section 64) but have no dedicated sidebar entry or permission of
// their own — they're managed inline from the Competitions screen, gated by
// the same "competitions.manage" permission.

export async function createSeasonAction(formData: FormData) {
  const user = await requirePermission("competitions.manage");
  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, null, "Season"); // seasons are club-wide

  const raw = Object.fromEntries(formData.entries());
  const parsedResult = seasonSchema.safeParse(raw);
  if (!parsedResult.success) {
    const labelIssue = parsedResult.error.issues.some((issue) => issue.path[0] === "label");
    return { error: labelIssue ? "invalid_season_label" : "invalid_season_data" };
  }
  const parsed = parsedResult.data;

  let season;
  try {
    season = await db.$transaction(async (tx) => {
      if (parsed.isCurrent) {
        await tx.season.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      }
      return tx.season.create({ data: parsed });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "season_exists" };
    }
    throw error;
  }

  await writeAuditLog({ userId: user.id, action: "season.create", entityType: "Season", entityId: season.id, changes: { after: parsed } });
  revalidatePath("/[locale]/dashboard/competitions", "page");
  revalidatePath("/[locale]/competitions", "page");
  return { id: season.id };
}

export async function createCompetitionAction(formData: FormData) {
  const user = await requirePermission("competitions.manage");
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsedInput = competitionSchema.parse(raw);
  let logoUrl = parsedInput.logoUrl ?? null;
  const logoFile = formData.get("logoFile") as File | null;
  if (logoFile && logoFile.size > 0 && logoFile.name) {
    const { uploadPublicFile, generatePublicStorageKey, validateUploadedImage } = await import("@/lib/storage");
    const buffer = Buffer.from(await logoFile.arrayBuffer());
    const validated = await validateUploadedImage(buffer);
    const key = generatePublicStorageKey("competitions", validated.ext);
    logoUrl = await uploadPublicFile({ key, buffer, mimeType: validated.mime });
  }
  const parsed = { ...parsedInput, teamId: parsedInput.teamId || null, logoUrl };
  assertTeamScope(scopeContext, parsed.teamId, "Competition");
  await db.season.findUniqueOrThrow({ where: { id: parsed.seasonId } });
  if (parsed.teamId) await db.team.findUniqueOrThrow({ where: { id: parsed.teamId } });

  const competition = await db.competition.create({ data: parsed });

  await writeAuditLog({
    userId: user.id,
    action: "competition.create",
    entityType: "Competition",
    entityId: competition.id,
    changes: { after: parsed }
  });
  revalidatePath("/[locale]/dashboard/competitions", "page");
  revalidatePath("/[locale]/competitions", "page");
  return { id: competition.id };
}

export async function updateCompetitionAction(competitionId: string, formData: FormData) {
  const user = await requirePermission("competitions.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.competition.findUniqueOrThrow({ where: { id: competitionId } });

  const raw = Object.fromEntries(formData.entries());
  const parsedInput = competitionSchema.parse(raw);
  let logoUrl = parsedInput.logoUrl ?? null;
  const logoFile = formData.get("logoFile") as File | null;
  if (logoFile && logoFile.size > 0 && logoFile.name) {
    const { uploadPublicFile, generatePublicStorageKey, validateUploadedImage } = await import("@/lib/storage");
    const buffer = Buffer.from(await logoFile.arrayBuffer());
    const validated = await validateUploadedImage(buffer);
    const key = generatePublicStorageKey("competitions", validated.ext);
    logoUrl = await uploadPublicFile({ key, buffer, mimeType: validated.mime });
  }
  const parsed = { ...parsedInput, teamId: parsedInput.teamId || null, logoUrl };
  assertDualTeamScope(scopeContext, before.teamId, parsed.teamId, "Competition");
  await db.season.findUniqueOrThrow({ where: { id: parsed.seasonId } });
  if (parsed.teamId) await db.team.findUniqueOrThrow({ where: { id: parsed.teamId } });

  const competition = await db.competition.update({ where: { id: competitionId }, data: parsed });

  await writeAuditLog({
    userId: user.id,
    action: "competition.update",
    entityType: "Competition",
    entityId: competition.id,
    changes: { before, after: parsed }
  });
  revalidatePath("/[locale]/dashboard/competitions", "page");
  revalidatePath("/[locale]/competitions", "page");
  return { id: competition.id };
}

export async function uploadCompetitionLogoAction(competitionId: string, formData: FormData) {
  const user = await requirePermission("competitions.manage");
  const comp = await db.competition.findUniqueOrThrow({ where: { id: competitionId } });
  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, comp.teamId, "Competition");

  const logoFile = formData.get("logoFile") as File | null;
  const logoUrlInput = formData.get("logoUrl") as string | null;

  let logoUrl: string | null = logoUrlInput?.trim() || null;

  if (logoFile && logoFile.size > 0 && logoFile.name) {
    try {
      const { uploadPublicFile, generatePublicStorageKey, validateUploadedImage } = await import("@/lib/storage");
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      const { ext, mime } = await validateUploadedImage(buffer);
      const key = generatePublicStorageKey("competitions", ext);
      logoUrl = await uploadPublicFile({ key, buffer, mimeType: mime });
    } catch (err) {
      console.error("[Competition Logo Upload] Failed:", err);
      throw new Error(err instanceof Error ? err.message : "فشل رفع شعار المسابقة");
    }
  }

  if (logoUrl) {
    await db.competition.update({
      where: { id: competitionId },
      data: { logoUrl }
    });

    await writeAuditLog({
      userId: user.id,
      action: "competition.updateLogo",
      entityType: "Competition",
      entityId: competitionId,
      changes: { before: comp.logoUrl, after: logoUrl }
    });

    revalidatePath("/[locale]/dashboard/competitions", "page");
    revalidatePath("/[locale]/competitions", "page");
  }

  return { logoUrl };
}

export async function saveCompetitionStandingsAction(
  competitionId: string,
  standings: import("@/lib/competitions").StandingTeamEntry[]
) {
  const user = await requirePermission("competitions.manage");
  const comp = await db.competition.findUniqueOrThrow({ where: { id: competitionId } });
  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, comp.teamId, "Competition");
  if (comp.type !== "LEAGUE") throw new Error("Standings can only be saved for league competitions.");
  const baselineAt = new Date().toISOString();
  const parsedStandings = rankStandings(standingsSchema.parse(standings).map((entry) => ({ ...entry, baselineAt })));

  // Persist every league opponent for reuse in future match forms. Keep any
  // existing crest; new entries start with the shared shield placeholder.
  const { getAllOpponentsList, saveOpponentClub } = await import("@/lib/opponents");
  const savedOpponents = await getAllOpponentsList();
  for (const team of parsedStandings) {
    if (!team.isOurClub && team.teamName && !savedOpponents.some((opponent) => opponent.name.normalize("NFKC").trim().toLocaleLowerCase() === team.teamName.normalize("NFKC").trim().toLocaleLowerCase())) {
      await saveOpponentClub(team.teamName, team.teamLogo || "/branding/opponent-crest-default.svg").catch(() => {});
    }
  }

  await db.competition.update({
    where: { id: competitionId },
    data: { standingsData: parsedStandings as any }
  });

  await writeAuditLog({
    userId: user.id,
    action: "competition.updateStandings",
    entityType: "Competition",
    entityId: competitionId,
    changes: { teamCount: parsedStandings.length }
  });

  revalidatePath("/[locale]/dashboard/competitions", "page");
  revalidatePath("/[locale]/competitions", "page");
  return { success: true };
}

export async function importOfficialRoundTwoSeniorStandingsAction(competitionId: string) {
  const user = await requirePermission("competitions.manage");
  const competition = await db.competition.findUnique({ where: { id: competitionId }, include: { team: { select: { category: true } } } });
  if (!competition) throw new Error("المسابقة غير موجودة.");
  if (competition.type !== "LEAGUE" || competition.team?.category !== "SENIOR") throw new Error("اختر مسابقة الدوري لفئة الأكابر.");
  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, competition.teamId, "Competition");
  const currentStandings = Array.isArray(competition.standingsData) ? competition.standingsData as Array<{ id?: unknown }> : [];
  if (currentStandings.length && !currentStandings.every((row) => typeof row.id === "string" && row.id.startsWith("official-r2-"))) {
    throw new Error("يوجد ترتيب محفوظ لهذه المسابقة؛ لن يتم استبداله تلقائيًا.");
  }

  const baselineAt = new Date().toISOString();
  const { getOfficialRoundTwoSeniorStandings } = await import("@/lib/competitions/round-two-seniors");
  const standings = getOfficialRoundTwoSeniorStandings(baselineAt).map((row, index) => ({ ...row, rank: index + 1 }));
  const { getAllOpponentsList, saveOpponentClub } = await import("@/lib/opponents");
  const savedOpponents = await getAllOpponentsList();
  for (const entry of standings.filter((row) => !row.isOurClub)) {
    if (!savedOpponents.some((opponent) => opponent.name.normalize("NFKC").trim().toLocaleLowerCase() === entry.teamName.normalize("NFKC").trim().toLocaleLowerCase())) {
      await saveOpponentClub(entry.teamName, "/branding/opponent-crest-default.svg");
    }
  }

  await db.competition.update({ where: { id: competitionId }, data: { standingsData: standings as any } });
  await writeAuditLog({ userId: user.id, action: "competition.importOfficialRoundTwoStandings", entityType: "Competition", entityId: competitionId, changes: { teamCount: standings.length, source: "official_round_two_seniors", baselineAt } });
  revalidatePath("/[locale]/dashboard/competitions", "page");
  revalidatePath("/[locale]/competitions", "page");
  return { success: true, teamCount: standings.length };
}

export async function saveCompetitionBracketAction(
  competitionId: string,
  bracket: import("@/lib/competitions").CupBracketData
) {
  const user = await requirePermission("competitions.manage");
  const comp = await db.competition.findUniqueOrThrow({ where: { id: competitionId } });
  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, comp.teamId, "Competition");
  if (comp.type !== "CUP") throw new Error("Knockout brackets can only be saved for cup competitions.");
  const parsedBracket = bracketSchema.parse(bracket);

  // Cache any opponent logos mentioned in cup matches
  const { saveOpponentClub } = await import("@/lib/opponents");
  for (const round of parsedBracket.rounds) {
    for (const match of round.matches) {
      if (!match.homeTeam.isOurClub && match.homeTeam.logo && match.homeTeam.name) {
        await saveOpponentClub(match.homeTeam.name, match.homeTeam.logo).catch(() => {});
      }
      if (!match.awayTeam.isOurClub && match.awayTeam.logo && match.awayTeam.name) {
        await saveOpponentClub(match.awayTeam.name, match.awayTeam.logo).catch(() => {});
      }
    }
  }

  await db.competition.update({
    where: { id: competitionId },
    data: { bracketData: parsedBracket as any }
  });

  await writeAuditLog({
    userId: user.id,
    action: "competition.updateBracket",
    entityType: "Competition",
    entityId: competitionId,
    changes: { roundsCount: parsedBracket.rounds.length }
  });

  revalidatePath("/[locale]/dashboard/competitions", "page");
  revalidatePath("/[locale]/competitions", "page");
  return { success: true };
}

