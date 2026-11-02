import { test } from "node:test";
import assert from "node:assert/strict";
import { CreateSessionSchema, CorrectResultSchema, SaveSessionMeasurementsSchema } from "@/lib/testing/validation";
import { assertTeamScope, type ResourceScopeContext } from "@/lib/mutation-guards";
import { SprintCalculator } from "@/lib/testing/protocols/sprint";
import { JumpCalculator } from "@/lib/testing/protocols/jump";

test("Security & Scope: assertTeamScope enforces live UserTeam boundary", () => {
  const restrictedCoach: ResourceScopeContext = {
    userId: "coach-1",
    isUnrestricted: false,
    authorizedTeamIds: ["team-u17", "team-u20"],
  };

  const unrestrictedAdmin: ResourceScopeContext = {
    userId: "admin-1",
    isUnrestricted: true,
    authorizedTeamIds: [],
  };

  // 1. Authorized team succeeds for restricted coach
  assert.doesNotThrow(() => {
    assertTeamScope(restrictedCoach, "team-u17", "TestSession");
  });

  // 2. Unauthorized team throws ForbiddenError for restricted coach
  assert.throws(
    () => {
      assertTeamScope(restrictedCoach, "team-senior", "TestSession");
    },
    (err: any) => err.name === "ForbiddenError" && err.message.includes("unauthorized_team")
  );

  // 3. Forged null / club-wide access throws ForbiddenError for restricted coach
  assert.throws(
    () => {
      assertTeamScope(restrictedCoach, null, "TestSession");
    },
    (err: any) => err.name === "ForbiddenError" && err.message.includes("club_wide_restricted")
  );

  // 4. Unrestricted admin can access any team and club-wide
  assert.doesNotThrow(() => {
    assertTeamScope(unrestrictedAdmin, "team-senior", "TestSession");
    assertTeamScope(unrestrictedAdmin, null, "TestSession");
  });
});

test("Validation: CreateSessionSchema rejects empty or malformed inputs", () => {
  // Empty teamId
  assert.throws(() => {
    CreateSessionSchema.parse({
      testDefinitionId: "def-1",
      teamId: "",
      title: "Valid Title",
      date: new Date(),
    });
  });

  // Title too short
  assert.throws(() => {
    CreateSessionSchema.parse({
      testDefinitionId: "def-1",
      teamId: "team-1",
      title: "A",
      date: new Date(),
    });
  });

  // Valid session input passes
  const valid = CreateSessionSchema.parse({
    testDefinitionId: "def-1",
    teamId: "team-1",
    title: "Mid-Season Assessment",
    date: new Date(),
    location: "Field A",
  });
  assert.equal(valid.title, "Mid-Season Assessment");
});

test("Validation: CorrectResultSchema requires at least 5 characters for audit reason", () => {
  // Short reason rejected
  assert.throws(() => {
    CorrectResultSchema.parse({
      resultId: "res-1",
      correctionReason: "fix", // only 3 chars
      measurements: [{ key: "level", value: "16", numericValue: 16 }],
    });
  });

  // Descriptive reason accepted
  const valid = CorrectResultSchema.parse({
    resultId: "res-1",
    correctionReason: "Timing gate optical sensor misalignment verified by video review.",
    measurements: [{ key: "level", value: "16", numericValue: 16 }],
  });
  assert.equal(valid.resultId, "res-1");
  assert.match(valid.correctionReason, /Timing gate/);
});

test("Validation: session saves reject duplicate player entries", () => {
  const parsed = SaveSessionMeasurementsSchema.safeParse({
    sessionId: "session-1",
    entries: [
      { playerId: "player-1", status: "ABSENT", measurements: [] },
      { playerId: "player-1", status: "VALID", measurements: [{ key: "time", value: "4.2" }] },
    ],
  });
  assert.equal(parsed.success, false);
});

test("Validation: correction can clear measurements for a non-valid status", () => {
  const parsed = CorrectResultSchema.parse({
    resultId: "result-1",
    correctionReason: "Player was absent; prior entry was recorded in error.",
    status: "ABSENT",
    measurements: [],
  });
  assert.equal(parsed.status, "ABSENT");
  assert.equal(parsed.measurements.length, 0);
});

test("Validation: SprintCalculator rejects physiologically impossible sprint times", () => {
  // 1.2s for a full 30m sprint is impossible (world record 30m split is ~3.7s)
  const impossibleInput = [{ key: "time_30m_1", value: "1.2", numericValue: 1.2 }];
  const val = SprintCalculator.validate(impossibleInput);
  assert.equal(val.valid, false);
  assert.match(val.error!, /Realistic range/);

  // 4.12s 30m sprint is realistic
  const realisticInput = [{ key: "time_30m_1", value: "4.12", numericValue: 4.12 }];
  const val2 = SprintCalculator.validate(realisticInput);
  assert.equal(val2.valid, true);

  // 5m split times are legitimately under 2.5s and must be storable
  const splitInput = [{ key: "time_5m_1", value: "1.2", numericValue: 1.2 }];
  assert.equal(SprintCalculator.validate(splitInput).valid, true);
});

test("Validation: JumpCalculator rejects physiologically impossible jump heights", () => {
  // 2cm jump is below valid range
  const impossibleInput = [{ key: "height_1", value: "2", numericValue: 2 }];
  const val = JumpCalculator.validate(impossibleInput);
  assert.equal(val.valid, false);

  // 150cm vertical jump is impossible
  const impossibleInput2 = [{ key: "height_1", value: "150", numericValue: 150 }];
  const val2 = JumpCalculator.validate(impossibleInput2);
  assert.equal(val2.valid, false);

  // 52.5cm is realistic
  const realisticInput = [{ key: "height_1", value: "52.5", numericValue: 52.5 }];
  const val3 = JumpCalculator.validate(realisticInput);
  assert.equal(val3.valid, true);
});
