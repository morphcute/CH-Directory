import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface RaffleChatMessage {
  id: string;
  raffleId: string;
  senderName: string;
  senderDeviceId?: string;
  isOrganizer?: boolean;
  isCurrentPick?: boolean;
  badge?: "organizer" | "candidate" | "entrant" | "spectator";
  text: string;
  timestamp: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __ch_raffleChatMessages: RaffleChatMessage[] | undefined;
  // eslint-disable-next-line no-var
  var __ch_raffleChatSubscribers: Set<(message: RaffleChatMessage) => void> | undefined;
}

const MAX_STORED_MESSAGES = 100;

function chatFilePath(): string {
  if (process.env.DATA_DIR) {
    return path.join(process.env.DATA_DIR, "raffle-chat.json");
  }
  if (process.env.VERCEL) {
    return path.join("/tmp", "raffle-chat.json");
  }
  return path.join(process.cwd(), "data", "raffle-chat.json");
}

function readPersistedMessages(): RaffleChatMessage[] {
  try {
    const file = chatFilePath();
    const content = readFileSync(file, "utf8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      globalThis.__ch_raffleChatMessages = parsed;
      return parsed;
    }
  } catch {}
  if (globalThis.__ch_raffleChatMessages) {
    return globalThis.__ch_raffleChatMessages;
  }
  return [];
}

function writePersistedMessages(messages: RaffleChatMessage[]): void {
  try {
    globalThis.__ch_raffleChatMessages = messages;
    const file = chatFilePath();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)), "utf8");
  } catch {}
}

const subscribers: Set<(message: RaffleChatMessage) => void> =
  globalThis.__ch_raffleChatSubscribers ?? (globalThis.__ch_raffleChatSubscribers = new Set());

export function getRecentChatMessages(raffleId?: string): RaffleChatMessage[] {
  const all = readPersistedMessages();
  if (!raffleId || raffleId === "default" || raffleId === "latest") {
    return all.slice(-MAX_STORED_MESSAGES);
  }
  return all.filter((m) => m.raffleId === raffleId || m.raffleId === "default").slice(-MAX_STORED_MESSAGES);
}

export function addChatMessage(data: {
  raffleId: string;
  senderName: string;
  senderDeviceId?: string;
  isOrganizer?: boolean;
  isCurrentPick?: boolean;
  badge?: "organizer" | "candidate" | "entrant" | "spectator";
  text: string;
}): RaffleChatMessage {
  const current = readPersistedMessages();
  const cleanText = data.text.trim().slice(0, 250);
  const cleanSender = data.senderName.trim().slice(0, 60) || "Anonymous";

  const message: RaffleChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    raffleId: data.raffleId || "default",
    senderName: cleanSender,
    senderDeviceId: data.senderDeviceId,
    isOrganizer: Boolean(data.isOrganizer),
    isCurrentPick: Boolean(data.isCurrentPick),
    badge: data.badge || (data.isOrganizer ? "organizer" : data.isCurrentPick ? "candidate" : "entrant"),
    text: cleanText,
    timestamp: Date.now(),
  };

  const updated = [...current, message].slice(-MAX_STORED_MESSAGES);
  writePersistedMessages(updated);

  subscribers.forEach((listener) => {
    try {
      listener(message);
    } catch {}
  });

  return message;
}

export function subscribeChatMessages(listener: (message: RaffleChatMessage) => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function clearChatMessages(raffleId?: string): void {
  if (!raffleId || raffleId === "all") {
    writePersistedMessages([]);
    return;
  }
  const current = readPersistedMessages();
  const filtered = current.filter((m) => m.raffleId !== raffleId);
  writePersistedMessages(filtered);
}
