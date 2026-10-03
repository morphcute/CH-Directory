import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readDbState, writeDbState, incrementPageViewsDb } from "@/server/db";
import {
  DEFAULT_REFRESH_TOKEN,
  DEFAULT_ADMIN_EMAIL,
} from "./googleConstants";
import type { AppState } from "@/types";

export const DEFAULT_SPREADSHEET_URL =
  process.env.SPREADSHEET_URL ||
  "https://docs.google.com/spreadsheets/d/1HUANmtnLjlGiNjyiYs4Dgp5rmm_71oH2qFuXMeZXkZw/edit?pli=1&gid=0#gid=0";

export const defaultState: AppState = {
  players: [],
  selectedNicknames: [],
  activeTabName: "",
  spreadsheetUrl: DEFAULT_SPREADSHEET_URL,
  rawTabsList: [],
  googleConnectedEmail: DEFAULT_ADMIN_EMAIL,
  googleRefreshToken: DEFAULT_REFRESH_TOKEN,
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
    if (dbState && Array.isArray(dbState.players) && dbState.players.length > 0) {
      const normalized = normalizePlayerCounts(dbState.players);
      const stateObj = {
        ...defaultState,
        ...dbState,
        googleRefreshToken:
          dbState.googleRefreshToken ||
          process.env.GOOGLE_REFRESH_TOKEN ||
          DEFAULT_REFRESH_TOKEN,
        googleConnectedEmail:
          dbState.googleConnectedEmail ||
          process.env.ADMIN_EMAIL ||
          DEFAULT_ADMIN_EMAIL,
        spreadsheetUrl: dbState.spreadsheetUrl || DEFAULT_SPREADSHEET_URL,
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
    let content = "";
    try {
      content = await readFile(file, "utf8");
    } catch {
      const bundled = path.join(process.cwd(), "data", "app-state.json");
      try {
        content = await readFile(bundled, "utf8");
      } catch {
        return defaultState;
      }
    }
    if (!content.trim()) return defaultState;
    const data = JSON.parse(content);
    if (!Array.isArray(data.players)) return defaultState;
    const normalized = normalizePlayerCounts(data.players);
    const stateObj = {
      ...defaultState,
      ...data,
      googleRefreshToken:
        data.googleRefreshToken ||
        process.env.GOOGLE_REFRESH_TOKEN ||
        DEFAULT_REFRESH_TOKEN,
      googleConnectedEmail:
        data.googleConnectedEmail ||
        process.env.ADMIN_EMAIL ||
        DEFAULT_ADMIN_EMAIL,
      spreadsheetUrl: data.spreadsheetUrl || DEFAULT_SPREADSHEET_URL,
      players: orderPlayersBySelection(normalized, data.selectedNicknames),
    };
    if (inMemoryPageViews !== null) {
      stateObj.pageViews = Math.max(stateObj.pageViews || 0, inMemoryPageViews);
    }
    return stateObj;
  } catch {
    return defaultState;
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
      googleRefreshToken:
        update.googleRefreshToken ||
        currentState.googleRefreshToken ||
        process.env.GOOGLE_REFRESH_TOKEN ||
        DEFAULT_REFRESH_TOKEN,
      googleConnectedEmail:
        update.googleConnectedEmail ||
        currentState.googleConnectedEmail ||
        process.env.ADMIN_EMAIL ||
        DEFAULT_ADMIN_EMAIL,
      spreadsheetUrl:
        update.spreadsheetUrl ||
        currentState.spreadsheetUrl ||
        DEFAULT_SPREADSHEET_URL,
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

    // 2. Backup to runtime file (e.g. /tmp/app-state.json on Vercel)
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
  try {
    const dbViews = await incrementPageViewsDb();
    if (typeof dbViews === "number") {
      inMemoryPageViews = dbViews;
      try {
        const file = statePath();
        const content = await readFile(file, "utf8").catch(() => "{}");
        const data = JSON.parse(content || "{}");
        data.pageViews = dbViews;
        await writeFile(file, JSON.stringify(data, null, 2), "utf8");
      } catch {}
      return dbViews;
    }
  } catch (err) {
    console.error("Failed to increment views in DB, using fallback:", err);
  }

  const current = await readState();
  const nextViews = (current.pageViews || 0) + 1;
  inMemoryPageViews = nextViews;
  return nextViews;
}
