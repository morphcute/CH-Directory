import { readState, saveState } from "@/server/store";
import {
  inspectPlayer,
  fetchTeamsFromResponseSheet,
  sheetRows,
  extractPRLCutoffFromSheet,
  getSpreadsheetTabs,
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

    // 1. If a master spreadsheet is configured, refresh tabs and detect next month's tournament!
    let activeTabToUse = state.activeTabName;
    let freshTabsList = state.rawTabsList || [];
    let isNewTournamentMonth = false;

    if (state.spreadsheetUrl) {
      try {
        const detected = await getSpreadsheetTabs(state.spreadsheetUrl, token);
        if (Array.isArray(detected.tabs) && detected.tabs.length > 0) {
          freshTabsList = detected.tabs;
          if (detected.autoDetectedTab) {
            // Check if active tab is changing to a new tournament month
            if (
              !state.activeTabName ||
              detected.autoDetectedTab.trim().toLowerCase() !==
                state.activeTabName.trim().toLowerCase()
            ) {
              isNewTournamentMonth = true;
              activeTabToUse = detected.autoDetectedTab;
              console.log(
                `[Sync] New tournament tab detected: "${activeTabToUse}" (previous was: "${state.activeTabName}")`,
              );
            }
          }
        }
      } catch (tabErr) {
        console.warn("Could not check tabs from master spreadsheet:", tabErr);
      }
    }

    // 2. Pull the lineup from the active tournament sheet tab
    if (state.spreadsheetUrl) {
      try {
        const { transformRowsToPlayers } = await import("@/utils/sheetDetector");
        const rows = await sheetRows(
          state.spreadsheetUrl,
          activeTabToUse || undefined,
          token,
        );

        if (Array.isArray(rows) && rows.length > 0) {
          const sheetPlayers = transformRowsToPlayers(rows);
          if (sheetPlayers.length > 0) {
            if (isNewTournamentMonth || basePlayers.length === 0) {
              // When moving to a NEW tournament month:
              // Start fresh with the new month's lineup and links from the new sheet!
              // Retain custom avatars and remarks from previously existing heroes
              const avatarMap = new Map<string, string>();
              const remarksMap = new Map<string, string>();
              for (const ep of basePlayers) {
                const key = ep.chNickname.toLowerCase().trim();
                if (ep.avatarUrl) avatarMap.set(key, ep.avatarUrl);
                if (ep.remarks) remarksMap.set(key, ep.remarks);
              }

              basePlayers = sheetPlayers.map((sp) => {
                const key = sp.chNickname.toLowerCase().trim();
                return {
                  ...sp,
                  avatarUrl: avatarMap.get(key) || sp.avatarUrl,
                  remarks: remarksMap.get(key) || sp.remarks,
                };
              });
            } else {
              // Same tournament month: merge preserving manual overrides & existing registered teams
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
                    active: sp.active !== undefined ? sp.active : existing.active,
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

    // 3. Inspect active players with tournament response sheets in parallel chunks of 10
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

    // 4. Dynamically extract Player Roster Lineup (PRL) cut-off from master spreadsheet
    let dynamicPrlCutoff: string | undefined = undefined;
    if (state.spreadsheetUrl) {
      try {
        dynamicPrlCutoff = await extractPRLCutoffFromSheet(
          state.spreadsheetUrl,
          freshTabsList.length > 0 ? freshTabsList : state.rawTabsList,
          token,
        );
      } catch (prlErr) {
        console.warn("Could not extract dynamic PRL cut-off:", prlErr);
      }
    }
    const finalPrlCutoff = dynamicPrlCutoff || state.prlCutoff;

    const finalSelectedNicknames =
      Array.isArray(state.selectedNicknames) && state.selectedNicknames.length > 0
        ? state.selectedNicknames
        : updatedPlayers.filter((p) => p.active).map((p) => p.chNickname);

    const selectedSet = new Set(
      finalSelectedNicknames.map((n) => n.toLowerCase().trim()),
    );

    // Only heroes selected by the admin appear as active in the public directory
    const finalPlayers = updatedPlayers.map((p) => ({
      ...p,
      active: selectedSet.has(p.chNickname.toLowerCase().trim()),
      prlCutoff: finalPrlCutoff || p.prlCutoff,
    }));

    const now = Date.now();

    await saveState({
      players: finalPlayers,
      selectedNicknames: finalSelectedNicknames,
      activeTabName: activeTabToUse,
      rawTabsList: freshTabsList,
      lastHourlySync: now,
      prlCutoff: finalPrlCutoff,
    });

    return {
      synced: true,
      count: finalPlayers.length,
      lastHourlySync: now,
      message: `Successfully synced ${finalPlayers.length} Community Heroes (${activeTabToUse || "default"})`,
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
 * Checks if sync interval has elapsed since the last sync.
 * If so, triggers a background sync without blocking the current request.
 * Automatically checks frequently (every 2 minutes) during active tournament preparation
 * so that newly added registration links and response sheets appear almost in real time!
 */
export async function checkAndTriggerHourlySync(): Promise<void> {
  try {
    const state = await readState();
    const lastSync = state.lastHourlySync || 0;
    const { isTabDatePassed } = await import("@/lib/tournaments");
    const isPast = isTabDatePassed(state.activeTabName);

    // Fast 2-minute interval (120,000 ms) during preparation or active registration,
    // so any hero adding a Form Link or Response Sheet goes live almost immediately!
    // Normal cadence is 15 minutes when all slots are full or idle.
    const syncIntervalMs = 2 * 60 * 1000;

    if (Date.now() - lastSync > syncIntervalMs && !syncInProgress) {
      // Fire-and-forget background sync
      void syncSpreadsheetBackground();
    }
  } catch {
    // Ignore error
  }
}

/**
 * Starts the server-side recurring ticker for automatic sync.
 */
export function ensureSyncSchedulerRunning(): void {
  if (intervalStarted) return;
  intervalStarted = true;

  // Run initial sync check after 5 seconds from server boot
  setTimeout(() => {
    void checkAndTriggerHourlySync();
  }, 5_000);

  // Set recurring check every 2 minutes for fast updates
  setInterval(() => {
    void checkAndTriggerHourlySync();
  }, 2 * 60 * 1000);
}
