import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readDbState, writeDbState, incrementPageViewsDb } from "@/server/db";
import type { AppState } from "@/types";

export const defaultState: AppState = {
  players: [],
  selectedNicknames: [],
  activeTabName: "",
  spreadsheetUrl: "",
  rawTabsList: [],
};

function statePath() {
  if (process.env.DATA_DIR) {
    return path.join(process.env.DATA_DIR, "app-state.json");
  }
  if (process.env.VERCEL) {
    return path.join("/tmp", "app-state.json");
  }
  return path.join(process.cwd(), "data", "app-state.json");
}

function normalizePlayerCounts(players: any[]): any[] {
  if (!Array.isArray(players)) return [];
  return players.map((p) => {
    if (Array.isArray(p.registeredTeams) && p.registeredTeams.length > 0) {
      return {
        ...p,
        teamsRegistered: p.registeredTeams.length,
      };
    }
    return p;
  });
}

export function orderPlayersBySelection(players: any[], selectedNicknames?: string[]): any[] {
  if (!Array.isArray(players)) return [];
  if (!Array.isArray(selectedNicknames) || selectedNicknames.length === 0) {
    return players;
  }

  const orderMap = new Map<string, number>();
  selectedNicknames.forEach((nick, idx) => {
    orderMap.set(nick.toLowerCase().trim(), idx);
  });

  return [...players].sort((a, b) => {
    if (a.active && b.active) {
      const aNick = (a.chNickname || "").toLowerCase().trim();
      const bNick = (b.chNickname || "").toLowerCase().trim();
      const aId = (a.id || "").toLowerCase().trim();
      const bId = (b.id || "").toLowerCase().trim();
      const aIdx = orderMap.has(aNick)
        ? orderMap.get(aNick)!
        : orderMap.has(aId)
          ? orderMap.get(aId)!
          : 999999;
      const bIdx = orderMap.has(bNick)
        ? orderMap.get(bNick)!
        : orderMap.has(bId)
          ? orderMap.get(bId)!
          : 999999;
      return aIdx - bIdx;
    }
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    return 0;
  });
}

export async function readState(): Promise<AppState> {
  // 1. Try Neon Database first
  try {
    const dbState = await readDbState();
    if (dbState && Array.isArray(dbState.players)) {
      const normalized = normalizePlayerCounts(dbState.players);
      const stateObj = {
        ...defaultState,
        ...dbState,
        players: orderPlayersBySelection(normalized, dbState.selectedNicknames),
      };
      if (inMemoryPageViews !== null) {
        stateObj.pageViews = Math.max(stateObj.pageViews || 0, inMemoryPageViews);
      }
      return stateObj;
    }
  } catch {
    // Silent fallback to file storage
  }

  // 2. Fallback to file storage
  try {
    const file = statePath();
    let content: string;
    try {
      content = await readFile(file, "utf8");
    } catch {
      const bundled = path.join(process.cwd(), "data", "app-state.json");
      content = await readFile(bundled, "utf8");
    }
    const data = JSON.parse(content);
    if (!Array.isArray(data.players)) throw new Error("Invalid directory data");
    const normalized = normalizePlayerCounts(data.players);
    const stateObj = {
      ...defaultState,
      ...data,
      players: orderPlayersBySelection(normalized, data.selectedNicknames),
    };
    if (inMemoryPageViews !== null) {
      stateObj.pageViews = Math.max(stateObj.pageViews || 0, inMemoryPageViews);
    }
    return stateObj;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaultState;
    throw error;
  }
}

let writeQueue: Promise<unknown> = Promise.resolve();

export function saveState(update: Partial<AppState>): Promise<AppState> {
  const task = writeQueue.then(async () => {
    const currentState = await readState();
    const finalSelectedNicknames = update.selectedNicknames ?? currentState.selectedNicknames;
    const normalized = normalizePlayerCounts(update.players ?? currentState.players);
    const orderedPlayers = orderPlayersBySelection(normalized, finalSelectedNicknames);

    const state: AppState = {
      ...currentState,
      ...update,
      players: orderedPlayers,
      selectedNicknames: finalSelectedNicknames,
      lastUpdated: Date.now(),
    };

    if (typeof update.pageViews === "number") {
      inMemoryPageViews = update.pageViews;
    }

    // 1. Save to Neon Database
    try {
      await writeDbState(state);
    } catch {
      // Non-critical if Neon is temporarily unreachable
    }

    // 2. Backup to local file (sanitize tokens so secrets never leak to disk or git)
    try {
      const file = statePath();
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      const { googleAccessToken: _a, googleRefreshToken: _r, googleTokenExpiresAt: _e, ...safeState } = state;
      await writeFile(temporary, JSON.stringify(safeState, null, 2), "utf8");
      await rename(temporary, file);
    } catch {
      // Non-critical if running in readonly environment
    }

    return state;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

let inMemoryPageViews: number | null = null;

export async function incrementPageViews(): Promise<number> {
  if (inMemoryPageViews === null) {
    const current = await readState();
    inMemoryPageViews = current.pageViews || 0;
  }
  inMemoryPageViews += 1;
  const nextViews = inMemoryPageViews;

  // Compute Optimization: Do not execute SQL writes to Neon on page views!
  // Update local file storage without waking Neon database.
  try {
    const file = statePath();
    let data: any = {};
    try {
      const content = await readFile(file, "utf8");
      data = JSON.parse(content);
    } catch {
      const bundled = path.join(process.cwd(), "data", "app-state.json");
      const content = await readFile(bundled, "utf8");
      data = JSON.parse(content);
    }
    data.pageViews = nextViews;
    await writeFile(file, JSON.stringify(data, null, 2), "utf8");
  } catch {
    // Non-critical local update
  }

  return nextViews;
}
