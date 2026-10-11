import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { readDbChatMessages, insertDbChatMessage, clearDbChatMessages as clearDbChat } from "@/server/db";

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
  // eslint-disable-next-line no-var
  var __ch_raffleChatLastFetchTime: number | undefined;
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

function readLocalMessages(): RaffleChatMessage[] {
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

function writeLocalMessages(messages: RaffleChatMessage[]): void {
  try {
    globalThis.__ch_raffleChatMessages = messages;
    const file = chatFilePath();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)), "utf8");
  } catch {}
}

const subscribers: Set<(message: RaffleChatMessage) => void> =
  globalThis.__ch_raffleChatSubscribers ?? (globalThis.__ch_raffleChatSubscribers = new Set());

export async function getRecentChatMessages(raffleId?: string): Promise<RaffleChatMessage[]> {
  // 1. Try Neon Postgres DB first (ensures cross-device and cross-serverless real-time sync)
  try {
    const dbMsgs = await readDbChatMessages(raffleId, MAX_STORED_MESSAGES);
    if (Array.isArray(dbMsgs)) {
      globalThis.__ch_raffleChatMessages = dbMsgs;
      writeLocalMessages(dbMsgs);
      return dbMsgs;
    }
  } catch (err) {
    console.warn("Neon DB error fetching chat messages:", err);
  }

  // 2. Fallback to local memory / disk cache
  const all = readLocalMessages();
  if (!raffleId || raffleId === "default" || raffleId === "latest") {
    return all.slice(-MAX_STORED_MESSAGES);
  }
  return all.filter((m) => m.raffleId === raffleId || m.raffleId === "default").slice(-MAX_STORED_MESSAGES);
}

export async function addChatMessage(data: {
  raffleId: string;
  senderName: string;
  senderDeviceId?: string;
  isOrganizer?: boolean;
  isCurrentPick?: boolean;
  badge?: "organizer" | "candidate" | "entrant" | "spectator";
  text: string;
}): Promise<RaffleChatMessage> {
  const cleanText = data.text.trim().slice(0, 300);
  const cleanSender = data.senderName.trim().slice(0, 80) || "Anonymous";

  const message: RaffleChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    raffleId: data.raffleId || "default",
    senderName: cleanSender,
    senderDeviceId: data.senderDeviceId,
    isOrganizer: Boolean(data.isOrganizer),
    isCurrentPick: Boolean(data.isCurrentPick),
    badge: data.badge || (data.isOrganizer ? "organizer" : data.isCurrentPick ? "candidate" : "entrant"),
    text: cleanText,
    timestamp: Date.now(),
  };

  // 1. Insert into Neon Postgres DB immediately for all viewers
  try {
    await insertDbChatMessage(message);
  } catch (err) {
    console.warn("Failed to insert message to Neon:", err);
  }

  // 2. Update local in-memory and disk store
  const current = readLocalMessages();
  const updated = [...current, message].slice(-MAX_STORED_MESSAGES);
  writeLocalMessages(updated);

  // 3. Immediately broadcast to local SSE subscribers
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

export async function clearChatMessages(raffleId?: string): Promise<void> {
  try {
    await clearDbChat(raffleId);
  } catch {}
  if (!raffleId || raffleId === "all" || raffleId === "default") {
    writeLocalMessages([]);
    return;
  }
  const current = readLocalMessages();
  const filtered = current.filter((m) => m.raffleId !== raffleId);
  writeLocalMessages(filtered);
}
