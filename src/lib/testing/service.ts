import "server-only";
import { db } from "@/lib/db";
import { requirePermission, hasPermission, type SessionUser } from "@/lib/permissions";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { writeAuditLog } from "@/lib/audit";
import { calculatorRegistry } from "./calculator-registry";
import { analyzePlayerHistory } from "./history-analyzer";
import type { PlayerPerformanceTrend } from "./types";
import {
  CreateSessionSchema,
  SaveSessionMeasurementsSchema,
  CorrectResultSchema,
  type PlayerMeasurementEntrySchema,
} from "./validation";
import type { z } from "zod";

export class TestingDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestingDomainError";
  }
}

/**
 * Checks either "testing.<action>" or "player_tests.<action>" (or wildcard) for user flexibility.
 */
function checkTestingPermission(user: SessionUser, action: "view" | "manage" | "correct" | "manage_definitions"): boolean {
  return (
    hasPermission(user, `testing.${action}`) ||
    hasPermission(user, `player_tests.${action}`) ||
    (action === "view" && hasPermission(user, "training.view")) ||
    (action === "manage" && hasPermission(user, "training.manage"))
  );
}

async function requireTestingPermission(action: "view" | "manage" | "correct" | "manage_definitions"): Promise<SessionUser> {
  const user = await requirePermission("players.view"); // Base check ensuring valid session
  if (!checkTestingPermission(user, action)) {
    throw new Error(`Forbidden: missing permission for testing.${action}`);
  }
  return user;
}

/**
 * Creates a new Test Session in DRAFT status.
 */
export async function createTestSession(input: z.infer<typeof CreateSessionSchema>) {
  const user = await requireTestingPermission("manage");
  const data = CreateSessionSchema.parse(input);

  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, data.teamId, "TestSession");

  const [definition, team] = await Promise.all([
    db.testDefinition.findUnique({ where: { id: data.testDefinitionId } }),
    db.team.findUnique({ where: { id: data.teamId } }),
  ]);

  if (!definition || !definition.active) {
    throw new TestingDomainError("Selected test protocol is invalid or inactive.");
  }
  if (!team || !team.active) {
    throw new TestingDomainError("Selected team is invalid or inactive.");
  }

  const session = await db.testSession.create({
    data: {
      testDefinitionId: data.testDefinitionId,
      teamId: data.teamId,
      conductorId: user.id,
      title: data.title,
      date: data.date,
      location: data.location ?? null,
      notes: data.notes ?? null,
      status: "DRAFT",
    },
    include: {
      testDefinition: true,
      team: true,
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "CREATE_TEST_SESSION",
    entityType: "TestSession",
    entityId: session.id,
    changes: { title: session.title, teamId: session.teamId, testCode: definition.code },
  });

  return session;
}

/**
 * Saves/updates measurements for a batch of players within a session.
 */
export async function saveSessionMeasurements(input: z.infer<typeof SaveSessionMeasurementsSchema>) {
  const user = await requireTestingPermission("manage");
  const data = SaveSessionMeasurementsSchema.parse(input);

  const session = await db.testSession.findUnique({
    where: { id: data.sessionId },
    include: { testDefinition: true }
  });
  if (!session) {
    throw new TestingDomainError("Test session not found.");
  }

  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, session.teamId, "TestSession");

  if (session.status === "COMPLETED") {
    throw new TestingDomainError("Cannot directly modify measurements of a COMPLETED session. Use the audited correction workflow.");
  }
  if (session.status !== "DRAFT") {
    throw new TestingDomainError("Only draft test sessions can be edited.");
  }

  const calculator = calculatorRegistry.get(session.testDefinition.calculationStrategy);

  // Validate that all players belong to this team
  const playerIds = data.entries.map((e) => e.playerId);
  const eligiblePlayers = await db.player.findMany({
    where: {
      id: { in: playerIds },
      teamId: session.teamId,
      status: "ACTIVE",
    },
    select: { id: true }
  });
  const eligibleSet = new Set(eligiblePlayers.map((p) => p.id));

  for (const entry of data.entries) {
    if (entry.status === "VALID" && entry.measurements.length === 0) {
      throw new TestingDomainError(`Player ${entry.playerId} is marked valid but has no measurements.`);
    }
    if (!eligibleSet.has(entry.playerId)) {
      throw new TestingDomainError(`Player ${entry.playerId} does not belong to the authorized team for this session.`);
    }
  }

  // Pre-calculate all measurements and validate BEFORE opening the database transaction
  const preparedEntries: Array<{
    playerId: string;
    status: string;
    summaryScore: number | null;
    secondaryScore: number | null;
    scoreDisplay: string | null;
    normalizedMeasurements: any[];
    notes: string | null;
  }> = [];

  for (const entry of data.entries) {
    let summaryScore: number | null = null;
    let secondaryScore: number | null = null;
    let scoreDisplay: string | null = null;
    let normalizedMeasurements: any[] = entry.measurements;

    if (entry.status === "VALID" && entry.measurements.length > 0) {
      const valRes = calculator.validate(entry.measurements);
      if (!valRes.valid) {
        throw new TestingDomainError(`Validation error for player ${entry.playerId}: ${valRes.error}`);
      }
      const calcRes = calculator.calculate({ measurements: entry.measurements });
      summaryScore = calcRes.summaryScore;
      secondaryScore = calcRes.secondaryScore ?? null;
      scoreDisplay = calcRes.scoreDisplay;
      normalizedMeasurements = calcRes.normalizedMeasurements;
    }

    preparedEntries.push({
      playerId: entry.playerId,
      status: entry.status,
      summaryScore,
      secondaryScore,
      scoreDisplay,
      normalizedMeasurements,
      notes: entry.notes ?? null,
    });
  }

  // Execute in transaction with expanded timeout to prevent timeout on large squads
  return await db.$transaction(
    async (tx) => {
      for (const entry of preparedEntries) {
        if (entry.status === "VALID" && entry.normalizedMeasurements.length > 0) {
          // Upsert TestResult
          const result = await tx.testResult.upsert({
            where: {
              sessionId_playerId: {
                sessionId: session.id,
                playerId: entry.playerId,
              }
            },
            update: {
              status: entry.status,
              summaryScore: entry.summaryScore,
              secondaryScore: entry.secondaryScore,
              primaryUnit: session.testDefinition.primaryUnit,
              scoreDisplay: entry.scoreDisplay,
              notes: entry.notes,
            },
            create: {
              sessionId: session.id,
              playerId: entry.playerId,
              status: entry.status,
              summaryScore: entry.summaryScore,
              secondaryScore: entry.secondaryScore,
              primaryUnit: session.testDefinition.primaryUnit,
              scoreDisplay: entry.scoreDisplay,
              notes: entry.notes,
            }
          });

          // Replace measurements
          await tx.measurement.deleteMany({ where: { resultId: result.id } });

          if (entry.normalizedMeasurements.length > 0) {
            await tx.measurement.createMany({
              data: entry.normalizedMeasurements.map((m, idx) => ({
                resultId: result.id,
                key: m.key,
                value: m.value,
                numericValue: m.numericValue ?? null,
                unit: m.unit ?? null,
                attempt: m.attempt ?? idx + 1,
                metadata: (m.metadata as any) ?? undefined,
              }))
            });
          }
        } else if (entry.status !== "VALID") {
          // Status is ABSENT, INCOMPLETE, or DISQUALIFIED: explicitly record non-valid status
          const result = await tx.testResult.upsert({
            where: {
              sessionId_playerId: {
                sessionId: session.id,
                playerId: entry.playerId,
              }
            },
            update: {
              status: entry.status as any,
              summaryScore: null,
              secondaryScore: null,
              primaryUnit: session.testDefinition.primaryUnit,
              scoreDisplay: null,
              notes: entry.notes,
            },
            create: {
              sessionId: session.id,
              playerId: entry.playerId,
              status: entry.status as any,
              summaryScore: null,
              secondaryScore: null,
              primaryUnit: session.testDefinition.primaryUnit,
              scoreDisplay: null,
              notes: entry.notes,
            }
          });
          await tx.measurement.deleteMany({ where: { resultId: result.id } });
        }
      }

      return { success: true, count: data.entries.length };
    },
    { timeout: 30000, maxWait: 10000 }
  );
}

/**
 * Completes a session: assigns ranks, locks results, and writes audit log.
 */
export async function completeTestSession(sessionId: string) {
  const user = await requireTestingPermission("manage");

  const session = await db.testSession.findUnique({
    where: { id: sessionId },
    include: {
      testDefinition: true,
      results: {
        where: { status: "VALID", summaryScore: { not: null } }
      }
    }
  });
  if (!session) {
    throw new TestingDomainError("Test session not found.");
  }
  if (session.status !== "DRAFT") {
    throw new TestingDomainError("Only draft test sessions can be completed.");
  }

  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, session.teamId, "TestSession");

  const direction = session.testDefinition.direction;

  // Rank valid results
  const sorted = [...session.results].sort((a, b) => {
    if (a.summaryScore === null || b.summaryScore === null) return 0;
    return direction === "HIGHER_IS_BETTER"
      ? b.summaryScore - a.summaryScore
      : a.summaryScore - b.summaryScore;
  });

  await db.$transaction(
    async (tx) => {
      let currentRank = 1;
      for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i]!;
        const prev = sorted[i - 1];
        if (prev && current.summaryScore !== prev.summaryScore) {
          currentRank = i + 1;
        }
        await tx.testResult.update({
          where: { id: current.id },
          data: { rank: currentRank }
        });
      }

      await tx.testSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        }
      });

      await writeAuditLog({
        userId: user.id,
        action: "COMPLETE_TEST_SESSION",
        entityType: "TestSession",
        entityId: sessionId,
        changes: {
          testedPlayersCount: sorted.length,
          protocol: session.testDefinition.code,
        }
      }, tx);
    },
    { timeout: 25000, maxWait: 10000 }
  );

  return { success: true, completedResults: sorted.length };
}

/**
 * Safely deletes a test session, cascading results & measurements, with team scoping and audit logging.
 */
export async function deleteTestSession(sessionId: string) {
  const user = await requireTestingPermission("manage");

  const session = await db.testSession.findUnique({
    where: { id: sessionId },
    include: { testDefinition: true }
  });
  if (!session) {
    throw new TestingDomainError("Test session not found.");
  }

  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, session.teamId, "TestSession");

  await db.$transaction(
    async (tx) => {
      await tx.testSession.delete({
        where: { id: sessionId }
      });

      await writeAuditLog(
        {
          userId: user.id,
          action: "DELETE_TEST_SESSION",
          entityType: "TestSession",
          entityId: sessionId,
          changes: {
            title: session.title,
            testCode: session.testDefinition.code,
            teamId: session.teamId
          }
        },
        tx
      );
    },
    { timeout: 25000, maxWait: 10000 }
  );

  return { success: true, id: sessionId };
}

/**
 * Audited correction workflow for a single test result.
 */
export async function correctTestResult(input: z.infer<typeof CorrectResultSchema>) {
  const user = await requireTestingPermission("correct");
  const data = CorrectResultSchema.parse(input);

  const existingResult = await db.testResult.findUnique({
    where: { id: data.resultId },
    include: {
      session: { include: { testDefinition: true } },
      measurements: true,
    }
  });
  if (!existingResult) {
    throw new TestingDomainError("Test result not found.");
  }

  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, existingResult.session.teamId, "TestResult");

  const calculator = calculatorRegistry.get(existingResult.session.testDefinition.calculationStrategy);
  const isValid = data.status === "VALID";
  if (isValid) {
    const valRes = calculator.validate(data.measurements);
    if (!valRes.valid) {
      throw new TestingDomainError(`Validation error: ${valRes.error}`);
    }
    if (data.measurements.length === 0) {
      throw new TestingDomainError("A valid correction requires at least one measurement.");
    }
  }

  const calcRes = isValid ? calculator.calculate({ measurements: data.measurements }) : null;

  const snapshotBefore = {
    summaryScore: existingResult.summaryScore,
    secondaryScore: existingResult.secondaryScore,
    scoreDisplay: existingResult.scoreDisplay,
    status: existingResult.status,
    notes: existingResult.notes,
    measurements: existingResult.measurements.map((m) => ({
      key: m.key,
      value: m.value,
      numericValue: m.numericValue,
      unit: m.unit,
      attempt: m.attempt,
    }))
  };

  return await db.$transaction(
    async (tx) => {
      // Replace measurements
      await tx.measurement.deleteMany({ where: { resultId: existingResult.id } });
      if (isValid) {
        await tx.measurement.createMany({
          data: (calcRes?.normalizedMeasurements ?? []).map((m, idx) => ({
            resultId: existingResult.id,
            key: m.key,
            value: m.value,
            numericValue: m.numericValue ?? null,
            unit: m.unit ?? null,
            attempt: m.attempt ?? idx + 1,
          }))
        });
      }

      // Update result
      const updated = await tx.testResult.update({
        where: { id: existingResult.id },
        data: {
          status: data.status,
          summaryScore: calcRes?.summaryScore ?? null,
          secondaryScore: calcRes?.secondaryScore ?? null,
          scoreDisplay: calcRes?.scoreDisplay ?? null,
          rank: null,
          notes: data.notes ?? existingResult.notes,
          isCorrected: true,
          correctionReason: data.correctionReason,
          correctedById: user.id,
          correctedAt: new Date(),
          originalData: snapshotBefore as any,
        }
      });

      await writeAuditLog({
        userId: user.id,
        action: "CORRECT_TEST_RESULT",
        entityType: "TestResult",
        entityId: existingResult.id,
        changes: {
          reason: data.correctionReason,
          before: snapshotBefore,
          after: {
            summaryScore: calcRes?.summaryScore ?? null,
            secondaryScore: calcRes?.secondaryScore ?? null,
            scoreDisplay: calcRes?.scoreDisplay ?? null,
          }
        }
      }, tx);

      return updated;
    },
    { timeout: 25000, maxWait: 10000 }
  );
}

/**
 * Retrieves a full test session with results and measurements.
 */
export async function getTestSessionWithResults(sessionId: string) {
  await requireTestingPermission("view");

  const session = await db.testSession.findUnique({
    where: { id: sessionId },
    include: {
      testDefinition: true,
      team: true,
      conductor: { select: { id: true, name: true, email: true } },
      results: {
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              shirtNumber: true,
              position: true,
              photoUrl: true,
              status: true,
            }
          },
          measurements: {
            orderBy: [{ attempt: "asc" }, { key: "asc" }]
          }
        },
        orderBy: [{ rank: "asc" }, { summaryScore: "desc" }]
      }
    }
  });

  if (!session) return null;

  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, session.teamId, "TestSession");

  return session;
}

/**
 * Retrieves performance history and trend analysis for a player in a test definition.
 */
export async function getPlayerTestingTrend(
  playerId: string,
  testDefinitionCode: string
): Promise<PlayerPerformanceTrend> {
  await requireTestingPermission("view");

  const player = await db.player.findUnique({
    where: { id: playerId },
    select: { id: true, teamId: true }
  });
  if (!player) {
    throw new TestingDomainError("Player not found.");
  }

  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, player.teamId, "Player");

  const definition = await db.testDefinition.findUnique({
    where: { code: testDefinitionCode }
  });
  if (!definition) {
    throw new TestingDomainError(`Test definition ${testDefinitionCode} not found.`);
  }

  const results = await db.testResult.findMany({
    where: {
      playerId,
      session: {
        testDefinitionId: definition.id,
        status: "COMPLETED",
      }
    },
    include: {
      session: {
        select: { id: true, title: true, date: true }
      }
    },
    orderBy: { session: { date: "asc" } }
  });

  const rows = results.map((r) => ({
    id: r.id,
    sessionId: r.session.id,
    sessionTitle: r.session.title,
    date: r.session.date,
    summaryScore: r.summaryScore,
    secondaryScore: r.secondaryScore,
    scoreDisplay: r.scoreDisplay,
    rank: r.rank,
    status: r.status,
    isCorrected: r.isCorrected,
    correctionReason: r.correctionReason,
  }));

  return analyzePlayerHistory(rows, definition.direction);
}
