import "server-only";

import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission, type SessionUser } from "@/lib/permissions";
import { type TeamScope } from "@/lib/authz/policy";
import { getFAFClient } from "./client";
import { shouldUpdateFieldFromFAF } from "./authority-matrix";
import {
  normalizeLicenceNumber,
  normalizePersonName,
  mapFafPositionToPrisma,
  mapFafPlayerStatusToPrisma
} from "./normalizer";
import { resolveTeamForFafCategory, resolveExistingPlayer } from "./entity-mapper";
import { FAFSessionManager } from "./session-manager";
import type { FAFSyncOptions, FAFSyncResult, FAFConflict } from "./types";

// ============================================================================
// PHASE 10B — TRANSACTIONAL FAF SYNCHRONIZATION SERVICE
// ----------------------------------------------------------------------------
// Enforces:
//  - RBAC permission verification
//  - Live Team-scoping boundary (coaches only sync their assigned teams)
//  - Atomicity: mutations and audit rows execute within database transactions
//  - Idempotency: repeated runs never generate duplicates
//  - Authority protection: local ESH data is strictly preserved
// ============================================================================

export async function syncFAFPlayers(
  user: SessionUser,
  scope: TeamScope,
  options?: FAFSyncOptions
): Promise<FAFSyncResult> {
  // 1. RBAC Check
  if (!hasPermission(user, "players.manage") && !hasPermission(user, "settings.manage")) {
    throw new Error("Unauthorized: players.manage or settings.manage permission required for FAF sync");
  }

  const startedAt = new Date();
  const client = getFAFClient();

  // Audit sync started
  await writeAuditLog({
    userId: user.id,
    action: "FAF_SYNC_STARTED",
    entityType: "Integration",
    changes: { category: options?.category, dryRun: options?.dryRun }
  });

  const result: FAFSyncResult = {
    status: "SUCCESS",
    startedAt,
    completedAt: new Date(),
    recordsInspected: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsUnchanged: 0,
    conflictsDetected: 0,
    errors: [],
    details: {
      playersProcessed: 0,
      staffProcessed: 0,
      matchesProcessed: 0
    }
  };

  try {
    // Check session health before network operations if HTTP adapter is active
    if (client.name === "faf-http-adapter") {
      const sessionCheck = await FAFSessionManager.validateSession();
      if (!sessionCheck.valid) {
        result.status = "AUTH_REQUIRED";
        result.completedAt = new Date();
        result.errors.push(sessionCheck.message);

        await writeAuditLog({
          userId: user.id,
          action: "FAF_SYNC_AUTH_REQUIRED",
          entityType: "Integration",
          changes: { reason: sessionCheck.message, status: sessionCheck.status }
        });

        return result;
      }
    }

    const rawFafPlayers = await client.fetchPlayers(options?.category);
    result.recordsInspected = rawFafPlayers.length;

    for (const rawPlayer of rawFafPlayers) {
      // 2. Resolve target team by category
      const targetTeam = await resolveTeamForFafCategory(rawPlayer.category);
      if (!targetTeam) {
        result.errors.push(`Unrecognized category '${rawPlayer.category}' for licence ${rawPlayer.licenceNumber}`);
        continue;
      }

      // 3. Team Scoping Enforcement:
      // If caller is team-scoped, reject synchronization for teams outside caller's scope
      if (scope.restricted && !scope.teamIds.includes(targetTeam.id)) {
        continue; // Skip silently without leaking or mutating cross-team data
      }

      const normLastName = normalizePersonName(rawPlayer.lastName);
      const normFirstName = normalizePersonName(rawPlayer.firstName);
      const normLicence = normalizeLicenceNumber(rawPlayer.licenceNumber);
      const birthYear = rawPlayer.dateOfBirth.split("-")[0];
      const canonicalSlug = `${normFirstName.toLowerCase()}-${normLastName.toLowerCase()}-${birthYear}`
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 80);

      // 4. Entity Resolution & Conflict Detection
      const resolution = await resolveExistingPlayer(rawPlayer, targetTeam.id);

      if (resolution.conflicts.length > 0) {
        result.conflictsDetected += resolution.conflicts.length;
        for (const conflict of resolution.conflicts) {
          await writeAuditLog({
            userId: user.id,
            action: "FAF_CONFLICT_DETECTED",
            entityType: "Player",
            entityId: resolution.player?.id ?? null,
            changes: conflict as any
          });
        }
      }

      if (options?.dryRun) {
        if (resolution.matchFound) result.recordsUpdated++;
        else result.recordsCreated++;
        result.details.playersProcessed++;
        continue;
      }

      // 5. Transactional Execution
      await db.$transaction(async (tx) => {
        if (resolution.matchFound && resolution.player) {
          const existing = resolution.player;
          const newStatus = mapFafPlayerStatusToPrisma(rawPlayer.status);

          // Apply Authority Matrix: Only update FAF-authoritative fields
          const shouldUpdateStatus = shouldUpdateFieldFromFAF("Player", "status");

          if (shouldUpdateStatus && existing.status !== newStatus) {
            await tx.player.update({
              where: { id: existing.id },
              data: {
                status: newStatus
              }
            });

            await writeAuditLog(
              {
                userId: user.id,
                action: "FAF_RECORD_UPDATED",
                entityType: "Player",
                entityId: existing.id,
                changes: {
                  licenceNumber: normLicence,
                  oldStatus: existing.status,
                  newStatus
                }
              },
              tx
            );
            result.recordsUpdated++;
          } else {
            result.recordsUnchanged++;
          }
        } else {
          // Create new player record atomically
          const newPlayer = await tx.player.create({
            data: {
              slug: canonicalSlug,
              firstName: normFirstName,
              lastName: normLastName,
              position: mapFafPositionToPrisma(null),
              nationality: rawPlayer.nationality || "Algérien",
              dateOfBirth: new Date(rawPlayer.dateOfBirth),
              status: mapFafPlayerStatusToPrisma(rawPlayer.status),
              teamId: targetTeam.id,
              internalNotes: `Affiliation FAF automatique. N° Licence: ${normLicence}`
            }
          });

          // Create translations for Arabic and French
          await tx.playerTranslation.createMany({
            data: [
              {
                playerId: newPlayer.id,
                locale: "fr",
                biography: `Joueur licencié FAF (${normLicence}) au sein de l'ESH.`
              },
              {
                playerId: newPlayer.id,
                locale: "ar",
                biography: `لاعب معتمد ومسجل لدى الاتحاد الجزائري لكرة القدم برخصة رقم (${normLicence}).`
              }
            ]
          });

          await writeAuditLog(
            {
              userId: user.id,
              action: "FAF_RECORD_CREATED",
              entityType: "Player",
              entityId: newPlayer.id,
              changes: {
                licenceNumber: normLicence,
                teamId: targetTeam.id,
                category: rawPlayer.category
              }
            },
            tx
          );
          result.recordsCreated++;
        }
      });

      result.details.playersProcessed++;
    }

    result.completedAt = new Date();

    await writeAuditLog({
      userId: user.id,
      action: "FAF_SYNC_COMPLETED",
      entityType: "Integration",
      changes: {
        recordsInspected: result.recordsInspected,
        recordsCreated: result.recordsCreated,
        recordsUpdated: result.recordsUpdated,
        recordsUnchanged: result.recordsUnchanged,
        conflicts: result.conflictsDetected
      }
    });

    return result;
  } catch (err: any) {
    const endpointUnavailable =
      err instanceof Error && err.message.startsWith("FAF_DATA_ENDPOINT_UNAVAILABLE:");
    result.status = endpointUnavailable ? "BLOCKED" : "FAILED";
    result.completedAt = new Date();
    result.errors.push(endpointUnavailable
      ? "No verified FAF data endpoint is configured. No platform records were changed."
      : err.message || "Unknown error during FAF player synchronization");

    await writeAuditLog({
      userId: user.id,
      action: endpointUnavailable ? "FAF_SYNC_BLOCKED" : "FAF_SYNC_FAILED",
      entityType: "Integration",
      changes: endpointUnavailable
        ? { reason: "NO_VERIFIED_DATA_ENDPOINT" }
        : { error: err.message }
    });

    return result;
  }
}

/**
 * Returns diagnostic metadata and health status of FAF integration.
 */
export async function getFAFIntegrationStatus() {
  const client = getFAFClient();
  const configured = client.isConfigured();
  const connection = await client.checkConnection();
  const sessionStatus = await FAFSessionManager.getStatus();

  const lastSyncLog = await db.auditLog.findFirst({
    where: { action: { in: ["FAF_SYNC_COMPLETED", "FAF_SYNC_FAILED", "FAF_SYNC_AUTH_REQUIRED", "FAF_SYNC_BLOCKED", "FAF_MATCH_SYNC_BLOCKED"] } },
    orderBy: { createdAt: "desc" }
  });

  return {
    configured,
    dataSyncSupported: true,
    dataSyncMessage: "FAF EMS history, match details and official Arabic reports are available for secure import from the match page.",
    connected: connection.connected,
    connectionMessage: connection.message,
    sessionStatus,
    sessionValid: sessionStatus.status === "AUTHENTICATED",
    sessionMessage: sessionStatus.message,
    latencyMs: connection.latencyMs,
    lastSyncAt: lastSyncLog?.createdAt ?? null,
    lastSyncAction: lastSyncLog?.action ?? null
  };
}
