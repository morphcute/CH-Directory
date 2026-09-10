interface ViewerSession {
  lastSeen: number;
  ip: string;
}

const viewers = new Map<string, ViewerSession>();
const viewerListeners = new Set<(count: number) => void>();

const VIEWER_TIMEOUT_MS = 25_000; // Drop viewer after 25s without heartbeat
const MAX_DEVICES_PER_IP = 5; // Anti-bot flood guard: max 5 concurrent devices per IP
const BOT_REGEX = /bot|spider|crawl|slurp|curl|wget|python|headless|lighthouse|preview/i;

function cleanStaleViewers(now = Date.now()): boolean {
  let changed = false;
  for (const [id, session] of viewers.entries()) {
    if (now - session.lastSeen > VIEWER_TIMEOUT_MS) {
      viewers.delete(id);
      changed = true;
    }
  }
  return changed;
}

function notifySubscribers(count: number) {
  viewerListeners.forEach((listener) => {
    try {
      listener(count);
    } catch {
      // safe ignore
    }
  });
}

export function isBotUserAgent(userAgent?: string | null): boolean {
  if (!userAgent) return false;
  return BOT_REGEX.test(userAgent);
}

export function registerViewer(viewerId: string, ip: string, userAgent?: string | null): number {
  if (!viewerId || typeof viewerId !== "string") {
    return getLiveViewerCount();
  }

  // Filter out automated bots, scrapers, and headless crawlers
  if (isBotUserAgent(userAgent)) {
    return getLiveViewerCount();
  }

  const now = Date.now();
  const cleaned = cleanStaleViewers(now);

  const cleanId = viewerId.trim().slice(0, 64);
  if (!cleanId) return getLiveViewerCount();

  // If this is a new viewer ID, check per-IP flood limits
  if (!viewers.has(cleanId)) {
    let devicesWithSameIp = 0;
    for (const session of viewers.values()) {
      if (session.ip === ip) {
        devicesWithSameIp++;
      }
    }
    if (devicesWithSameIp >= MAX_DEVICES_PER_IP) {
      return viewers.size;
    }
  }

  const isNew = !viewers.has(cleanId);
  viewers.set(cleanId, {
    lastSeen: now,
    ip: ip || "127.0.0.1",
  });

  const count = viewers.size;
  if (isNew || cleaned) {
    notifySubscribers(count);
  }

  return count;
}

export function removeViewer(viewerId: string): number {
  if (!viewerId || typeof viewerId !== "string") {
    return getLiveViewerCount();
  }

  const cleanId = viewerId.trim().slice(0, 64);
  const existed = viewers.delete(cleanId);
  const cleaned = cleanStaleViewers();

  const count = viewers.size;
  if (existed || cleaned) {
    notifySubscribers(count);
  }

  return count;
}

export function getLiveViewerCount(): number {
  cleanStaleViewers();
  return viewers.size;
}

export function subscribeViewerCount(listener: (count: number) => void): () => void {
  viewerListeners.add(listener);
  return () => {
    viewerListeners.delete(listener);
  };
}

// Reset helper for tests
export function _resetLiveViewers(): void {
  viewers.clear();
  viewerListeners.clear();
}
