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
}

let activeLiveSpin: LiveSpinState | null = null;
const subscribers = new Set<(state: LiveSpinState | null) => void>();

export function getLiveSpinState(): LiveSpinState | null {
  if (activeLiveSpin) {
    const elapsed = Date.now() - activeLiveSpin.startedAt;
    const maxActive = activeLiveSpin.claimDeadline
      ? Math.max(activeLiveSpin.durationMs + 180_000, activeLiveSpin.claimDeadline - activeLiveSpin.startedAt + 60_000)
      : activeLiveSpin.durationMs + 120_000;

    if (elapsed > maxActive) {
      activeLiveSpin = null;
    }
  }
  return activeLiveSpin;
}

export function broadcastLiveSpin(state: LiveSpinState | null): LiveSpinState | null {
  activeLiveSpin = state;
  subscribers.forEach((listener) => {
    try {
      listener(activeLiveSpin);
    } catch {
      // safe ignore
    }
  });
  return activeLiveSpin;
}

export function subscribeLiveSpin(listener: (state: LiveSpinState | null) => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}
