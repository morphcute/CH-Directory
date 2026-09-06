import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readDbState, writeDbState } from "@/server/db";
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
      return {
        ...defaultState,
        ...dbState,
        players: normalizePlayerCounts(dbState.players),
      };
    }
  } catch (err) {
    console.error("Neon DB read error, falling back to local file:", err);
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
    return {
      ...defaultState,
      ...data,
      players: normalizePlayerCounts(data.players),
    };
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

    // 1. Save to Neon Database
    try {
      await writeDbState(state);
    } catch (err) {
      console.error("Neon DB write error:", err);
    }

    // 2. Backup to local file (sanitize tokens so secrets never leak to disk or git)
    try {
      const file = statePath();
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      const { googleAccessToken: _a, googleRefreshToken: _r, googleTokenExpiresAt: _e, ...safeState } = state;
      await writeFile(temporary, JSON.stringify(safeState, null, 2), "utf8");
      await rename(temporary, file);
    } catch (err) {
      // Non-critical if running in readonly environment
    }

    return state;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}
