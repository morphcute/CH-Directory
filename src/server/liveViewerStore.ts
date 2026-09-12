export interface LiveViewerInfo {
  id: string;
  name: string;
  isParticipant: boolean;
  isOrganizer: boolean;
  joinedAt: number;
  lastSeen: number;
}

interface ViewerSession extends LiveViewerInfo {
  ip: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __ch_liveViewers: Map<string, ViewerSession> | undefined;
  // eslint-disable-next-line no-var
  var __ch_liveViewerListeners: Set<(data: { count: number; viewers: LiveViewerInfo[] }) => void> | undefined;
}

const viewers: Map<string, ViewerSession> =
  globalThis.__ch_liveViewers ?? (globalThis.__ch_liveViewers = new Map());

const viewerListeners: Set<(data: { count: number; viewers: LiveViewerInfo[] }) => void> =
  globalThis.__ch_liveViewerListeners ?? (globalThis.__ch_liveViewerListeners = new Set());

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

function notifySubscribers() {
  const count = viewers.size;
  const list = getLiveViewerList();
  viewerListeners.forEach((listener) => {
    try {
      listener({ count, viewers: list });
    } catch {
      // safe ignore
    }
  });
}

export function isBotUserAgent(userAgent?: string | null): boolean {
  if (!userAgent) return false;
  return BOT_REGEX.test(userAgent);
}

export function registerViewer(
  viewerId: string,
  ip: string,
  userAgent?: string | null,
  details?: { entryName?: string; isOrganizer?: boolean }
): number {
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

  const isOrganizer = Boolean(details?.isOrganizer);
  const entryName = details?.entryName?.trim();
  const isParticipant = Boolean(entryName);

  const existing = viewers.get(cleanId);
  if (existing) {
    existing.lastSeen = now;
    if (isOrganizer) {
      existing.isOrganizer = true;
      existing.name = "Organizer (Host)";
    } else if (entryName) {
      existing.name = entryName;
      existing.isParticipant = true;
    }
    if (cleaned) notifySubscribers();
    return viewers.size;
  }

  // Check per-IP flood limits for new viewers
  let devicesWithSameIp = 0;
  for (const session of viewers.values()) {
    if (session.ip === ip) {
      devicesWithSameIp++;
    }
  }
  if (devicesWithSameIp >= MAX_DEVICES_PER_IP) {
    return viewers.size;
  }

  // Determine displayName
  let displayName = `Spectator #${viewers.size + 1}`;
  if (isOrganizer) {
    displayName = "Organizer (Host)";
  } else if (entryName) {
    displayName = entryName;
  }

  viewers.set(cleanId, {
    id: cleanId,
    name: displayName,
    isParticipant,
    isOrganizer,
    joinedAt: now,
    lastSeen: now,
    ip: ip || "127.0.0.1",
  });

  notifySubscribers();
  return viewers.size;
}

export function removeViewer(viewerId: string): number {
  if (!viewerId || typeof viewerId !== "string") {
    return getLiveViewerCount();
  }

  const cleanId = viewerId.trim().slice(0, 64);
  const existed = viewers.delete(cleanId);
  const cleaned = cleanStaleViewers();

  if (existed || cleaned) {
    notifySubscribers();
  }

  return viewers.size;
}

export function getLiveViewerCount(): number {
  cleanStaleViewers();
  return viewers.size;
}

export function getLiveViewerList(): LiveViewerInfo[] {
  cleanStaleViewers();
  return Array.from(viewers.values())
    .map((v) => ({
      id: v.id,
      name: v.name,
      isParticipant: v.isParticipant,
      isOrganizer: v.isOrganizer,
      joinedAt: v.joinedAt,
      lastSeen: v.lastSeen,
    }))
    .sort((a, b) => {
      // Organizers first, then registered participants, then spectators
      if (a.isOrganizer !== b.isOrganizer) return a.isOrganizer ? -1 : 1;
      if (a.isParticipant !== b.isParticipant) return a.isParticipant ? -1 : 1;
      return a.joinedAt - b.joinedAt;
    });
}

export function subscribeViewerUpdates(
  listener: (data: { count: number; viewers: LiveViewerInfo[] }) => void
): () => void {
  viewerListeners.add(listener);
  return () => {
    viewerListeners.delete(listener);
  };
}

export function subscribeViewerCount(listener: (count: number) => void): () => void {
  const wrapped = (data: { count: number; viewers: LiveViewerInfo[] }) => listener(data.count);
  viewerListeners.add(wrapped as any);
  return () => {
    viewerListeners.delete(wrapped as any);
  };
}

// Reset helper for tests
export function _resetLiveViewers(): void {
  viewers.clear();
  viewerListeners.clear();
}
