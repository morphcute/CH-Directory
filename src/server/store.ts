import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { INITIAL_SEPTEMBER_PLAYERS, INITIAL_TABS } from "@/data/initialData";
import type { AppState } from "@/types";

export const defaultState: AppState = {
  players: INITIAL_SEPTEMBER_PLAYERS,
  selectedNicknames: INITIAL_SEPTEMBER_PLAYERS.filter((p) => p.active).map(
    (p) => p.chNickname,
  ),
  activeTabName: "September 5, 2026",
  spreadsheetUrl:
    "https://docs.google.com/spreadsheets/d/1HUANmtnLjlGiNjyiYs4Dgp5rmm_71oH2qFuXMeZXkZw/edit",
  rawTabsList: INITIAL_TABS,
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
export async function readState(): Promise<AppState> {
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
    return { ...defaultState, ...data };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaultState;
    throw error;
  }
}
let writeQueue: Promise<unknown> = Promise.resolve();
export function saveState(update: Partial<AppState>): Promise<AppState> {
  const task = writeQueue.then(async () => {
    const state = {
      ...(await readState()),
      ...update,
      lastUpdated: Date.now(),
    };
    const file = statePath();
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), "utf8");
    await rename(temporary, file);
    return state;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}
