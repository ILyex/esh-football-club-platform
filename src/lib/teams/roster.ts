import type { PlayerStatus } from "@prisma/client";

/** Player statuses included in both the dashboard and public team roster totals. */
export const ROSTER_PLAYER_STATUSES = ["ACTIVE", "INJURED", "SUSPENDED"] as const satisfies readonly PlayerStatus[];
