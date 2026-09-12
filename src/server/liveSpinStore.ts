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

const subscribers: Set<(state: LiveSpinState | null, mode: "wheel" | "duck_race") => void> =
  globalThis.__ch_liveSpinSubscribers ?? (globalThis.__ch_liveSpinSubscribers = new Set());

export function getActiveDrawMode(): "wheel" | "duck_race" {
  return globalThis.__ch_activeDrawMode || globalThis.__ch_liveSpinState?.drawMode || "wheel";
}

export function setActiveDrawMode(mode: "wheel" | "duck_race"): "wheel" | "duck_race" {
  globalThis.__ch_activeDrawMode = mode;
  if (globalThis.__ch_liveSpinState) {
    globalThis.__ch_liveSpinState.drawMode = mode;
  }
  subscribers.forEach((listener) => {
    try {
      listener(globalThis.__ch_liveSpinState || null, mode);
    } catch {
      // safe ignore
    }
  });
  return mode;
}

export function getLiveSpinState(): LiveSpinState | null {
  const active = globalThis.__ch_liveSpinState;
  if (active) {
    const elapsed = Date.now() - active.startedAt;
    // Awarded or idle state expires quickly (8 seconds) to return to ready state
    const maxActive = active.isAwarded || active.status === "idle"
      ? 8_000
      : active.claimDeadline
        ? Math.max(active.durationMs + 180_000, active.claimDeadline - active.startedAt + 60_000)
        : active.durationMs + 120_000;

    if (elapsed > maxActive) {
      globalThis.__ch_liveSpinState = null;
    }
  }
  return globalThis.__ch_liveSpinState || null;
}

export function broadcastLiveSpin(state: LiveSpinState | null): LiveSpinState | null {
  globalThis.__ch_liveSpinState = state;
  if (state?.drawMode) {
    globalThis.__ch_activeDrawMode = state.drawMode;
  }
  const currentMode = getActiveDrawMode();
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


