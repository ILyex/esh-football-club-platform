import "server-only";

import { db } from "@/lib/db";
import { normalizeLicenceNumber, normalizePersonName, mapFafCategoryToPrisma } from "./normalizer";
import type { FAFLicenceData, FAFConflict } from "./types";
import type { Team, Player } from "@prisma/client";

// ============================================================================
// PHASE 10B — ENTITY MAPPER & CONFLICT RESOLVER
// ----------------------------------------------------------------------------
// Maps external FAF identities to internal ESH records.
// Disallows matching solely on `firstName + lastName` due to Algerian homonym risks.
// Strictly detects operational conflicts and records them for review.
// ============================================================================

export interface PlayerResolutionResult {
  matchFound: boolean;
  player: Player | null;
  conflicts: FAFConflict[];
}

/**
 * Resolves an ESH Team record corresponding to an incoming FAF category.
 */
export async function resolveTeamForFafCategory(rawCategory: string): Promise<Team | null> {
  const prismaCategory = mapFafCategoryToPrisma(rawCategory);
  const team = await db.team.findUnique({
    where: { category: prismaCategory }
  });
  return team;
}

/**
 * Resolves an existing ESH player record against an incoming FAF licence record.
 * Matching hierarchy:
 *  1. Exact slug match (canonical normalized identifier: firstName-lastName-birthYear)
 *  2. Multi-attribute alignment: exact dateOfBirth + lastName (case-insensitive)
 *
 * NEVER matches solely on firstName + lastName!
 */
export async function resolveExistingPlayer(
  fafPlayer: FAFLicenceData,
  targetTeamId?: string | null
): Promise<PlayerResolutionResult> {
  const normLastName = normalizePersonName(fafPlayer.lastName).toLowerCase();
  const normFirstName = normalizePersonName(fafPlayer.firstName).toLowerCase();
  const birthYear = fafPlayer.dateOfBirth.split("-")[0];
  const expectedSlug = `${normFirstName}-${normLastName}-${birthYear}`
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);

  const conflicts: FAFConflict[] = [];

  // 1. Try slug match
  let existingPlayer = await db.player.findUnique({
    where: { slug: expectedSlug }
  });

  // 2. If not found by slug, search by dateOfBirth and lastName
  if (!existingPlayer) {
    const dob = new Date(fafPlayer.dateOfBirth);
    const candidates = await db.player.findMany({
      where: {
        dateOfBirth: dob,
        lastName: { contains: normLastName, mode: "insensitive" }
      }
    });

    if (candidates.length === 1) {
      existingPlayer = candidates[0] ?? null;
    } else if (candidates.length > 1) {
      conflicts.push({
        entityType: "Player",
        identifier: fafPlayer.licenceNumber,
        field: "identity",
        eshValue: `${candidates.length} candidates found with identical DOB and lastName`,
        fafValue: `${fafPlayer.firstName} ${fafPlayer.lastName}`,
        resolution: "MANUAL_REVIEW_REQUIRED",
        reason: "Homonym ambiguity: multiple ESH players share this birthdate and last name"
      });
      return { matchFound: false, player: null, conflicts };
    }
  }

  // Detect team assignment conflicts
  if (existingPlayer && targetTeamId && existingPlayer.teamId && existingPlayer.teamId !== targetTeamId) {
    conflicts.push({
      entityType: "Player",
      identifier: fafPlayer.licenceNumber,
      field: "teamId",
      eshValue: existingPlayer.teamId,
      fafValue: targetTeamId,
      resolution: "PRESERVE_ESH",
      reason: "FAF category assignment differs from local active team assignment. Preserving local team."
    });
  }

  return {
    matchFound: Boolean(existingPlayer),
    player: existingPlayer,
    conflicts
  };
}
