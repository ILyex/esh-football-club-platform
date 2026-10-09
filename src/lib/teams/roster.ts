import type { PlayerStatus } from "@prisma/client";

/** Only active players are exposed in public rosters and active selection lists. */
export const ROSTER_PLAYER_STATUSES = ["ACTIVE"] as const satisfies readonly PlayerStatus[];
