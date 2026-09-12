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
  var __ch_liveSpinSubscribers: Set<(state: LiveSpinState | null) => void> | undefined;
}

const subscribers: Set<(state: LiveSpinState | null) => void> =
  globalThis.__ch_liveSpinSubscribers ?? (globalThis.__ch_liveSpinSubscribers = new Set());

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
  subscribers.forEach((listener) => {
    try {
      listener(globalThis.__ch_liveSpinState || null);
    } catch {
      // safe ignore
    }
  });
  return globalThis.__ch_liveSpinState || null;
}

export function subscribeLiveSpin(listener: (state: LiveSpinState | null) => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

