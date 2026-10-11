import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

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

function readPersistedLiveSpin(): { state: LiveSpinState | null; mode?: "wheel" | "duck_race" } | null {
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

function writePersistedLiveSpin(state: LiveSpinState | null, mode: "wheel" | "duck_race"): void {
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
  const persisted = readPersistedLiveSpin();
  if (persisted?.mode) {
    globalThis.__ch_activeDrawMode = persisted.mode;
    return persisted.mode;
  }
  if (globalThis.__ch_activeDrawMode) return globalThis.__ch_activeDrawMode;
  if (globalThis.__ch_liveSpinState?.drawMode) return globalThis.__ch_liveSpinState.drawMode;
  return "wheel";
}

export function setActiveDrawMode(mode: "wheel" | "duck_race"): "wheel" | "duck_race" {
  globalThis.__ch_activeDrawMode = mode;
  // Read current live spin state so changing draw mode NEVER wipes out the candidate!
  const current = getLiveSpinState();
  if (current) {
    current.drawMode = mode;
  }
  writePersistedLiveSpin(current || null, mode);
  subscribers.forEach((listener) => {
    try {
      listener(current || null, mode);
    } catch {
      // safe ignore
    }
  });
  return mode;
}

export function getLiveSpinState(): LiveSpinState | null {
  // Always inspect persisted state from disk to guarantee synchronization
  // across all Next.js worker threads and serverless lambdas
  const persisted = readPersistedLiveSpin();
  let candidate: LiveSpinState | null = null;

  if (persisted && persisted.state) {
    candidate = persisted.state;
    if (persisted.mode) {
      globalThis.__ch_activeDrawMode = persisted.mode;
    }
  } else if (globalThis.__ch_liveSpinState) {
    candidate = globalThis.__ch_liveSpinState;
  }

  if (candidate) {
    const elapsed = Date.now() - candidate.startedAt;
    // Awarded or idle state expires after 30 seconds to return to ready state
    // Landed state awaiting attendance check stays valid indefinitely until admin picks another winner, repicks, or awards!
    const maxActive =
      candidate.isAwarded || candidate.status === "idle"
        ? 30_000
        : candidate.status === "landed"
          ? 24 * 60 * 60 * 1000 // Keep landed pick available until admin picks another winner!
          : (candidate.durationMs || 8000) + 120_000;

    if (elapsed > maxActive) {
      globalThis.__ch_liveSpinState = null;
      writePersistedLiveSpin(null, getActiveDrawMode());
      return null;
    }
    globalThis.__ch_liveSpinState = candidate;
    return candidate;
  }

  globalThis.__ch_liveSpinState = null;
  return null;
}

export function broadcastLiveSpin(state: LiveSpinState | null): LiveSpinState | null {
  globalThis.__ch_liveSpinState = state;
  if (state?.drawMode) {
    globalThis.__ch_activeDrawMode = state.drawMode;
  }
  const currentMode = getActiveDrawMode();
  writePersistedLiveSpin(state, currentMode);
  subscribers.forEach((listener) => {
    try {
      listener(globalThis.__ch_liveSpinState || null, currentMode);
    } catch {
      // safe ignore
    }
  });
  return globalThis.__ch_liveSpinState || null;
}

export function subscribeLiveSpin(listener: (state: LiveSpinState | null, mode: "wheel" | "duck_race") => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}



