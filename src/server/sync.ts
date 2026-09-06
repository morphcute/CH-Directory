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
    if (!state.players || state.players.length === 0) {
      return {
        synced: false,
        count: 0,
        lastHourlySync: Date.now(),
        message: "No players in directory",
      };
    }

    const token = state.googleAccessToken;
    const updatedPlayers: CHPlayer[] = [];

    // Inspect active players with tournament response sheets in parallel chunks of 5
    for (let i = 0; i < state.players.length; i += 5) {
      const chunk = state.players.slice(i, i + 5);
      const results = await Promise.all(
        chunk.map(async (player) => {
          if (!player.active) return player;
          try {
            // 1. Inspect capacity and response sheet counts
            const inspected = await inspectPlayer(player, token);

            // 2. Fetch live teams if response sheet exists
            if (player.tournamentResponseSheet) {
              try {
                const teams = await fetchTeamsFromResponseSheet(
                  player.tournamentResponseSheet,
                  token,
                );
                if (teams && teams.length > 0) {
                  inspected.registeredTeams = teams;
                  inspected.teamsRegistered = Math.max(
                    inspected.teamsRegistered,
                    teams.length,
                  );
                }
              } catch {
                // Keep existing registered teams
              }
            }

            // 3. Mark status accurately based on slots
            if (inspected.teamsRegistered >= (inspected.maxTeams || 16)) {
              inspected.formStatus = "full";
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
