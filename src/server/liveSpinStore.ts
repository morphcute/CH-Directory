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
}

let activeLiveSpin: LiveSpinState | null = null;
const subscribers = new Set<(state: LiveSpinState | null) => void>();

export function getLiveSpinState(): LiveSpinState | null {
  if (activeLiveSpin) {
    const elapsed = Date.now() - activeLiveSpin.startedAt;
    // Auto-expire landed spin after 30 seconds of inactivity
    if (elapsed > activeLiveSpin.durationMs + 30_000) {
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
