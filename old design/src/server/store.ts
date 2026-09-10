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

export async function readState(): Promise<AppState> {
  // 1. Try Neon Database first
  try {
    const dbState = await readDbState();
    if (dbState && Array.isArray(dbState.players)) {
      const stateObj = {
        ...defaultState,
        ...dbState,
        players: normalizePlayerCounts(dbState.players),
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
    const stateObj = {
      ...defaultState,
      ...data,
      players: normalizePlayerCounts(data.players),
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
    const state: AppState = {
      ...currentState,
      ...update,
      players: normalizePlayerCounts(update.players ?? currentState.players),
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
