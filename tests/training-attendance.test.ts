import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bulkAttendanceSchema } from "@/lib/validations/training";

describe("bulkAttendanceSchema", () => {
  it("validates valid bulk attendance records", () => {
    const input = {
      attendances: [
        { playerId: "player-1", status: "PRESENT" },
        { playerId: "player-2", status: "ABSENT" },
        { playerId: "player-3", status: "INJURED" },
        { playerId: "player-4", status: "EXCUSED" }
      ]
    };

    const parsed = bulkAttendanceSchema.parse(input);
    assert.equal(parsed.attendances.length, 4);
    assert.equal(parsed.attendances[0].status, "PRESENT");
    assert.equal(parsed.attendances[1].status, "ABSENT");
    assert.equal(parsed.attendances[2].status, "INJURED");
    assert.equal(parsed.attendances[3].status, "EXCUSED");
  });

  it("rejects invalid status", () => {
    const input = {
      attendances: [
        { playerId: "player-1", status: "UNKNOWN_STATUS" }
      ]
    };

    assert.throws(() => {
      bulkAttendanceSchema.parse(input);
    });
  });

  it("rejects empty playerId", () => {
    const input = {
      attendances: [
        { playerId: "", status: "PRESENT" }
      ]
    };

    assert.throws(() => {
      bulkAttendanceSchema.parse(input);
    });
  });
});
