import { readState, saveState } from "@/server/store";
import {
  inspectPlayer,
  fetchTeamsFromResponseSheet,
  sheetRows,
  extractPRLCutoffFromSheet,
  getSpreadsheetTabs,
} from "@/server/sheets";
import type { CHPlayer } from "@/types";

export interface SyncProgress {
  inProgress: boolean;
  stage:
    | "idle"
    | "detecting_tabs"
    | "fetching_sheet"
    | "inspecting_heroes"
    | "saving"
    | "complete"
    | "error";
  current: number;
  total: number;
  currentHeroName?: string;
  message: string;
  startedAt?: number;
  completedAt?: number;
  lastHourlySync?: number;
}

let syncInProgress = false;
let intervalStarted = false;

let syncProgress: SyncProgress = {
  inProgress: false,
  stage: "idle",
  current: 0,
  total: 0,
  message: "Idle",
};

const STALE_LOCK_MS = 40_000;

export function getSyncProgress(): SyncProgress {
  if (
    syncProgress.inProgress &&
    syncProgress.startedAt &&
    Date.now() - syncProgress.startedAt > STALE_LOCK_MS
  ) {
    syncProgress.inProgress = false;
    syncProgress.stage = "idle";
    syncProgress.message = "Idle";
    syncInProgress = false;
  }
  return { ...syncProgress };
}

export function forceResetSyncLock(): void {
  syncInProgress = false;
  syncProgress = {
    inProgress: false,
    stage: "idle",
    current: 0,
    total: 0,
    message: "Sync lock reset by organizer",
    completedAt: Date.now(),
  };
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

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
    if (syncProgress.startedAt && Date.now() - syncProgress.startedAt > STALE_LOCK_MS) {
      console.warn("[Sync] Stale sync lock detected (>40s). Auto-recovering lock.");
      syncInProgress = false;
    } else {
      const current = await readState();
      return {
        synced: false,
        count: current.players.length,
        lastHourlySync: current.lastHourlySync || 0,
        message: `Sync in progress (${syncProgress.current}/${syncProgress.total || current.players.length})`,
      };
    }
  }

  syncInProgress = true;
  syncProgress = {
    inProgress: true,
    stage: "detecting_tabs",
    current: 0,
    total: 0,
    message: "Connecting to master spreadsheet...",
    startedAt: Date.now(),
  };

  try {
    const state = await readState();
    let basePlayers = [...(state.players || [])];

    if (basePlayers.length === 0 && !state.spreadsheetUrl) {
      syncProgress = {
        inProgress: false,
        stage: "complete",
        current: 0,
        total: 0,
        message: "No players in directory and no spreadsheet configured",
        completedAt: Date.now(),
      };
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
      syncProgress.stage = "fetching_sheet";
      syncProgress.message = "Reading tournament roster from master sheet...";
      try {
        const { transformRowsToPlayers } = await import("@/utils/sheetDetector");
        const rows = await sheetRows(
          state.spreadsheetUrl,
          activeTabToUse || undefined,
          token,
          true,
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
      syncProgress = {
        inProgress: false,
        stage: "complete",
        current: 0,
        total: 0,
        message: "No players found in spreadsheet or directory",
        completedAt: Date.now(),
      };
      return {
        synced: false,
        count: 0,
        lastHourlySync: Date.now(),
        message: "No players found in spreadsheet or directory",
      };
    }

    const updatedPlayers: CHPlayer[] = [];

    syncProgress.stage = "inspecting_heroes";
    syncProgress.total = basePlayers.length;
    syncProgress.current = 0;
    syncProgress.message = `Inspecting Community Heroes (0/${basePlayers.length})...`;

    let completedCount = 0;
    // 3. Inspect active players with tournament response sheets in parallel
    const selectedNicks = new Set(
      (state.selectedNicknames || []).map((n) => n.toLowerCase().trim()),
    );
    const hasSelection = selectedNicks.size > 0;

    const needsInspection = (p: CHPlayer) => {
      const isSelected = hasSelection
        ? selectedNicks.has((p.chNickname || "").toLowerCase().trim())
        : p.active;
      const hasLink = Boolean(
        p.tournamentResponseSheet ||
          p.registrationFormLink ||
          p.tournamentPostingLink,
      );
      
      // If syncOnlyListed is explicitly false, it syncs ALL players with a link.
      // Otherwise, it only syncs the active/listed ones.
      if (state.syncOnlyListed === false) {
        return hasLink;
      }
      return isSelected && hasLink;
    };

    const results = await mapConcurrent(
      basePlayers,
      3,
      async (player) => {
        if (!needsInspection(player)) {
          completedCount++;
          syncProgress.current = completedCount;
          return player;
        }

        try {
          // 25-second timeout per hero with concurrency limiter so sheets are reliably read
          const inspected = await Promise.race([
            inspectPlayer(player, token),
            new Promise<CHPlayer>((resolve) =>
              setTimeout(() => {
                resolve({
                  ...player,
                  formStatusDetail: "Inspection timed out (taking longer than 25s)",
                });
              }, 25000),
            ),
          ]);

          const regCount =
            Array.isArray(inspected.registeredTeams) &&
            inspected.registeredTeams.length > 0
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
        } finally {
          completedCount++;
          syncProgress.current = completedCount;
          syncProgress.currentHeroName = player.chNickname || player.fullName;
          syncProgress.message = `Inspecting Community Heroes (${completedCount}/${basePlayers.length})...`;
        }
      },
    );
    updatedPlayers.push(...results);

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

    syncProgress.stage = "saving";
    syncProgress.message = "Saving updated tournament directory...";

    const now = Date.now();

    await saveState({
      players: finalPlayers,
      selectedNicknames: finalSelectedNicknames,
      activeTabName: activeTabToUse,
      rawTabsList: freshTabsList,
      lastHourlySync: now,
      prlCutoff: finalPrlCutoff,
    });

    syncProgress = {
      inProgress: false,
      stage: "complete",
      current: finalPlayers.length,
      total: finalPlayers.length,
      message: `Successfully synced ${finalPlayers.length} Community Heroes (${activeTabToUse || "default"})`,
      completedAt: now,
      lastHourlySync: now,
    };

    return {
      synced: true,
      count: finalPlayers.length,
      lastHourlySync: now,
      message: `Successfully synced ${finalPlayers.length} Community Heroes (${activeTabToUse || "default"})`,
    };
  } catch (error) {
    console.error("Background spreadsheet sync error:", error);
    syncProgress = {
      inProgress: false,
      stage: "error",
      current: syncProgress.current,
      total: syncProgress.total,
      message: (error as Error).message || "Sync failed",
      completedAt: Date.now(),
    };
    return {
      synced: false,
      count: 0,
      lastHourlySync: Date.now(),
      message: (error as Error).message || "Sync failed",
    };
  } finally {
    syncInProgress = false;
    if (syncProgress.stage !== "error") {
      syncProgress.inProgress = false;
    }
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
    const isEmpty = !Array.isArray(state.players) || state.players.length === 0;

    // 30-minute interval (1,800,000 ms) to keep sheets updated while protecting database hours
    const syncIntervalMs = 30 * 60 * 1000; // 30 minutes (1,800,000 ms)

    if ((isEmpty || Date.now() - lastSync > syncIntervalMs) && !syncInProgress) {
      await syncSpreadsheetBackground();
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
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NODE_ENV === "test"
  ) {
    return;
  }
  intervalStarted = true;

  // Run initial sync check after 10 seconds from server boot
  const initTimer = setTimeout(() => {
    void checkAndTriggerHourlySync();
  }, 10_000);
  if (typeof initTimer.unref === "function") {
    initTimer.unref();
  }

  // Set recurring check every 30 minutes (1,800,000 ms)
  const intervalTimer = setInterval(() => {
    void checkAndTriggerHourlySync();
  }, 30 * 60 * 1000);
  if (typeof intervalTimer.unref === "function") {
    intervalTimer.unref();
  }
}
