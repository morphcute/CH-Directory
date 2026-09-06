import { readState, saveState } from "@/server/store";
import {
  inspectPlayer,
  fetchTeamsFromResponseSheet,
  sheetRows,
} from "@/server/sheets";
import type { CHPlayer } from "@/types";

let syncInProgress = false;
let intervalStarted = false;

/**
 * Automatically syncs response sheets and team rosters for all listed Community Heroes.
 * Runs in the background independently of whether an admin is logged in.
 */
export async function syncSpreadsheetBackground(): Promise<{
  synced: boolean;
  count: number;
  lastHourlySync: number;
  message: string;
}> {
  if (syncInProgress) {
    const current = await readState();
    return {
      synced: false,
      count: current.players.length,
      lastHourlySync: current.lastHourlySync || 0,
      message: "Sync already in progress",
    };
  }

  syncInProgress = true;
  try {
    const state = await readState();
    let basePlayers = [...(state.players || [])];

    if (basePlayers.length === 0 && !state.spreadsheetUrl) {
      return {
        synced: false,
        count: 0,
        lastHourlySync: Date.now(),
        message: "No players in directory and no spreadsheet configured",
      };
    }

    const { getValidGoogleAccessToken } = await import("./googleToken");
    const token = (await getValidGoogleAccessToken()) || state.googleAccessToken;

    // 1. If a master spreadsheet is configured, pull the full lineup from the sheet tab!
    if (state.spreadsheetUrl) {
      try {
        const { transformRowsToPlayers } = await import("@/utils/sheetDetector");
        const rows = await sheetRows(
          state.spreadsheetUrl,
          state.activeTabName || undefined,
          token,
        );

        if (Array.isArray(rows) && rows.length > 0) {
          const sheetPlayers = transformRowsToPlayers(rows);
          if (sheetPlayers.length > 0) {
            if (basePlayers.length === 0) {
              basePlayers = sheetPlayers;
            } else {
              // Merge sheet players with existing state (preserving manual overrides)
              const merged: CHPlayer[] = [];
              const seenNicks = new Set<string>();

              for (const sp of sheetPlayers) {
                const normNick = sp.chNickname.toLowerCase().trim();
                seenNicks.add(normNick);

                const existing = basePlayers.find(
                  (p) =>
                    p.chNickname.toLowerCase().trim() === normNick ||
                    (p.fullName &&
                      sp.fullName &&
                      p.fullName.toLowerCase().trim() ===
                        sp.fullName.toLowerCase().trim()),
                );

                if (existing) {
                  const regTeams = existing.registeredTeams || sp.registeredTeams;
                  const count =
                    regTeams && regTeams.length > 0
                      ? regTeams.length
                      : sp.teamsRegistered > 0
                        ? sp.teamsRegistered
                        : 0;
                  merged.push({
                    ...sp,
                    id: existing.id,
                    active: existing.active !== undefined ? existing.active : sp.active,
                    teamsRegistered: count,
                    registeredTeams: regTeams,
                    avatarUrl: existing.avatarUrl || sp.avatarUrl,
                    remarks: existing.remarks || sp.remarks,
                    facebookProfileUrl:
                      sp.facebookProfileUrl || existing.facebookProfileUrl,
                  });
                } else {
                  merged.push(sp);
                }
              }

              // Keep any custom heroes manually added in admin that aren't in the sheet
              for (const ep of basePlayers) {
                if (!seenNicks.has(ep.chNickname.toLowerCase().trim())) {
                  merged.push(ep);
                }
              }

              basePlayers = merged;
            }
          }
        }
      } catch (sheetErr) {
        console.warn("Could not refresh from master spreadsheet:", sheetErr);
      }
    }

    if (basePlayers.length === 0) {
      return {
        synced: false,
        count: 0,
        lastHourlySync: Date.now(),
        message: "No players found in spreadsheet or directory",
      };
    }

    const updatedPlayers: CHPlayer[] = [];

    // 2. Inspect active players with tournament response sheets in parallel chunks of 10
    for (let i = 0; i < basePlayers.length; i += 10) {
      const chunk = basePlayers.slice(i, i + 10);
      const results = await Promise.all(
        chunk.map(async (player) => {
          if (!player.active) return player;
          try {
            // Inspect capacity and response sheet counts (and extracts registeredTeams)
            const inspected = await inspectPlayer(player, token);

            // Mark status accurately based on actual registered slots vs max teams
            const regCount =
              Array.isArray(inspected.registeredTeams) && inspected.registeredTeams.length > 0
                ? inspected.registeredTeams.length
                : inspected.teamsRegistered;
            inspected.teamsRegistered = regCount;
            const max = inspected.maxTeams || 16;
            if (inspected.teamsRegistered >= max) {
              inspected.formStatus = "full";
            } else if (inspected.formStatus !== "closed") {
              inspected.formStatus = "open";
            }

            return inspected;
          } catch {
            return player;
          }
        }),
      );
      updatedPlayers.push(...results);
    }

    const now = Date.now();
    await saveState({
      players: updatedPlayers,
      selectedNicknames: updatedPlayers
        .filter((p) => p.active)
        .map((p) => p.chNickname),
      lastHourlySync: now,
    });

    return {
      synced: true,
      count: updatedPlayers.length,
      lastHourlySync: now,
      message: `Successfully synced ${updatedPlayers.length} Community Heroes`,
    };
  } catch (error) {
    console.error("Background spreadsheet sync error:", error);
    return {
      synced: false,
      count: 0,
      lastHourlySync: Date.now(),
      message: (error as Error).message || "Sync failed",
    };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Checks if more than 1 hour (3600 seconds) has elapsed since the last sync.
 * If so, triggers a background sync without blocking the current request.
 */
export async function checkAndTriggerHourlySync(): Promise<void> {
  try {
    const state = await readState();
    const lastSync = state.lastHourlySync || 0;
    const oneHourMs = 60 * 60 * 1000;

    if (Date.now() - lastSync > oneHourMs && !syncInProgress) {
      // Fire-and-forget background sync
      void syncSpreadsheetBackground();
    }
  } catch {
    // Ignore error
  }
}

/**
 * Starts the server-side recurring 1-hour interval for automatic sync.
 */
export function ensureSyncSchedulerRunning(): void {
  if (intervalStarted) return;
  intervalStarted = true;

  // Run initial sync check after 30 seconds from server boot
  setTimeout(() => {
    void checkAndTriggerHourlySync();
  }, 30_000);

  // Set recurring 1-hour interval (3,600,000 ms)
  setInterval(() => {
    void syncSpreadsheetBackground();
  }, 60 * 60 * 1000);
}
