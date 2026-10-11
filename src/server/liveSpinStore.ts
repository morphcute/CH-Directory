import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { readDbLiveSpinState, writeDbLiveSpinState } from "@/server/db";

export interface LiveSpinState {
  id: string;
  raffleId: string;
  prize: string;
  winnerId: string;
  winnerName: string;
  winningIndex: number;
  startedAt: number;
  durationMs: number;
  sliceCount: number;
  status: "spinning" | "landed" | "idle";
  claimDeadline?: number | null;
  claimSeconds?: number;
  isAwarded?: boolean;
  entrants?: { id: string; fullName: string }[];
  excludedIds?: string[];
  shuffledAt?: number;
  drawMode?: "wheel" | "duck_race";
}

declare global {
  // eslint-disable-next-line no-var
  var __ch_liveSpinState: LiveSpinState | null | undefined;
  // eslint-disable-next-line no-var
  var __ch_activeDrawMode: ("wheel" | "duck_race") | undefined;
  // eslint-disable-next-line no-var
  var __ch_liveSpinSubscribers: Set<(state: LiveSpinState | null, mode: "wheel" | "duck_race") => void> | undefined;
  // eslint-disable-next-line no-var
  var __ch_liveSpinLastDbFetch: number | undefined;
}

function liveSpinFilePath(): string {
  if (process.env.DATA_DIR) {
    return path.join(process.env.DATA_DIR, "live-spin.json");
  }
  if (process.env.VERCEL) {
    return path.join("/tmp", "live-spin.json");
  }
  return path.join(process.cwd(), "data", "live-spin.json");
}

let lastKnownGoodState: LiveSpinState | null = null;
let lastKnownGoodMode: "wheel" | "duck_race" = "wheel";

function readLocalLiveSpin(): { state: LiveSpinState | null; mode?: "wheel" | "duck_race" } | null {
  try {
    const file = liveSpinFilePath();
    const content = readFileSync(file, "utf8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object") {
      if (parsed.state !== undefined) {
        lastKnownGoodState = parsed.state;
      }
      if (parsed.mode) {
        lastKnownGoodMode = parsed.mode;
      }
      return parsed;
    }
  } catch {}
  if (lastKnownGoodState) {
    return { state: lastKnownGoodState, mode: lastKnownGoodMode };
  }
  return null;
}

function writeLocalLiveSpin(state: LiveSpinState | null, mode: "wheel" | "duck_race"): void {
  try {
    lastKnownGoodState = state;
    lastKnownGoodMode = mode;
    globalThis.__ch_liveSpinState = state;
    globalThis.__ch_activeDrawMode = mode;
    const file = liveSpinFilePath();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ state, mode, updatedAt: Date.now() }), "utf8");
  } catch {}
}

const subscribers: Set<(state: LiveSpinState | null, mode: "wheel" | "duck_race") => void> =
  globalThis.__ch_liveSpinSubscribers ?? (globalThis.__ch_liveSpinSubscribers = new Set());

export function getActiveDrawMode(): "wheel" | "duck_race" {
  if (globalThis.__ch_activeDrawMode) return globalThis.__ch_activeDrawMode;
  const local = readLocalLiveSpin();
  if (local?.mode) {
    globalThis.__ch_activeDrawMode = local.mode;
    return local.mode;
  }
  return "wheel";
}

export async function getActiveDrawModeAsync(): Promise<"wheel" | "duck_race"> {
  try {
    const db = await readDbLiveSpinState();
    if (db?.mode) {
      globalThis.__ch_activeDrawMode = db.mode;
      return db.mode;
    }
  } catch {}
  return getActiveDrawMode();
}

export function setActiveDrawMode(mode: "wheel" | "duck_race"): "wheel" | "duck_race" {
  globalThis.__ch_activeDrawMode = mode;
  const current = getLiveSpinState();
  if (current) {
    current.drawMode = mode;
  }
  writeLocalLiveSpin(current || null, mode);
  void writeDbLiveSpinState(current || null, mode);

  subscribers.forEach((listener) => {
    try {
      listener(current || null, mode);
    } catch {}
  });
  return mode;
}

export function getLiveSpinState(): LiveSpinState | null {
  const local = readLocalLiveSpin();
  let candidate: LiveSpinState | null = null;

  if (local && local.state !== undefined) {
    candidate = local.state;
    if (local.mode) globalThis.__ch_activeDrawMode = local.mode;
  } else if (globalThis.__ch_liveSpinState) {
    candidate = globalThis.__ch_liveSpinState;
  }

  if (candidate) {
    const elapsed = Date.now() - candidate.startedAt;
    // Status validation
    if (candidate.status === "landed" && !candidate.isAwarded) {
      // Landed candidate awaiting attendance check remains active indefinitely until host awards or repicks!
      globalThis.__ch_liveSpinState = candidate;
      return candidate;
    }
    const maxActive =
      candidate.isAwarded || candidate.status === "idle"
        ? 30_000
        : (candidate.durationMs || 8000) + 60_000;

    if (elapsed > maxActive) {
      globalThis.__ch_liveSpinState = null;
      writeLocalLiveSpin(null, getActiveDrawMode());
      return null;
    }
    globalThis.__ch_liveSpinState = candidate;
    return candidate;
  }

  globalThis.__ch_liveSpinState = null;
  return null;
}

export async function getLiveSpinStateAsync(): Promise<LiveSpinState | null> {
  // 1. Read single source of truth from Neon Postgres DB
  try {
    const db = await readDbLiveSpinState();
    if (db) {
      if (db.mode) globalThis.__ch_activeDrawMode = db.mode;
      const candidate = db.state;
      if (candidate) {
        const elapsed = Date.now() - candidate.startedAt;
        if (candidate.status === "landed" && !candidate.isAwarded) {
          globalThis.__ch_liveSpinState = candidate;
          writeLocalLiveSpin(candidate, db.mode || "wheel");
          return candidate;
        }
        const maxActive =
          candidate.isAwarded || candidate.status === "idle"
            ? 30_000
            : (candidate.durationMs || 8000) + 60_000;

        if (elapsed <= maxActive) {
          globalThis.__ch_liveSpinState = candidate;
          writeLocalLiveSpin(candidate, db.mode || "wheel");
          return candidate;
        } else {
          globalThis.__ch_liveSpinState = null;
          writeLocalLiveSpin(null, db.mode || "wheel");
          void writeDbLiveSpinState(null, db.mode || "wheel");
          return null;
        }
      } else {
        globalThis.__ch_liveSpinState = null;
        writeLocalLiveSpin(null, db.mode || "wheel");
        return null;
      }
    }
  } catch (err) {
    console.warn("Neon DB error fetching live spin state:", err);
  }

  // 2. Fallback to local memory / disk state
  return getLiveSpinState();
}

export function broadcastLiveSpin(state: LiveSpinState | null): LiveSpinState | null {
  globalThis.__ch_liveSpinState = state;
  if (state?.drawMode) {
    globalThis.__ch_activeDrawMode = state.drawMode;
  }
  const currentMode = getActiveDrawMode();
  writeLocalLiveSpin(state, currentMode);
  // Persist to Neon Postgres DB immediately for all viewers on any serverless lambda!
  void writeDbLiveSpinState(state, currentMode);

  subscribers.forEach((listener) => {
    try {
      listener(globalThis.__ch_liveSpinState || null, currentMode);
    } catch {}
  });
  return globalThis.__ch_liveSpinState || null;
}

export function subscribeLiveSpin(listener: (state: LiveSpinState | null, mode: "wheel" | "duck_race") => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}
