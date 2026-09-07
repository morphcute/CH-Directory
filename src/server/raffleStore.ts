import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  readDbRaffle,
  readDbArchivedRaffles,
  archiveDbRaffle,
  createDbNewRaffle,
  writeDbRaffleSettings,
  submitOrUpdateDbRaffleEntry,
  assignDbRaffleWinner,
  deleteDbRaffleEntry,
  resetDbRaffleEntries,
  deleteDbRaffle,
  unarchiveDbRaffle,
  updateDbArchivedRaffle,
} from "@/server/db";
import type { RaffleData, RaffleEntry, RaffleArchiveSummary } from "@/types";

const DEFAULT_RAFFLE: RaffleData = {
  id: "default",
  title: "Community Heroes Grand Raffle",
  description:
    "Enter your Full Name below to join the official Community Heroes giveaway! Winners will be announced after the cut-off date.",
  cutoffDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  prizes: ["Starlight Card", "100 Diamonds", "100 Diamonds", "50 Diamonds"],
  isActive: true,
  entries: [],
};

function localRafflePath(): string {
  if (process.env.DATA_DIR) {
    return path.join(process.env.DATA_DIR, "raffle-state.json");
  }
  if (process.env.VERCEL) {
    return path.join("/tmp", "raffle-state.json");
  }
  return path.join(process.cwd(), "data", "raffle-state.json");
}

async function readLocalRaffle(): Promise<RaffleData> {
  try {
    const filePath = localRafflePath();
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && parsed.id) {
      return parsed as RaffleData;
    }
  } catch {}
  return DEFAULT_RAFFLE;
}

async function writeLocalRaffle(data: RaffleData): Promise<void> {
  try {
    const filePath = localRafflePath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write local raffle fallback:", err);
  }
}

export async function getRaffleState(raffleId = "default"): Promise<RaffleData> {
  // 1. Try Neon DB
  try {
    const dbRaffle = await readDbRaffle(raffleId);
    if (dbRaffle) {
      void writeLocalRaffle(dbRaffle); // Keep local fallback fresh in background
      return dbRaffle;
    }
  } catch (err) {
    console.warn("Neon DB read error for raffle, using local file:", err);
  }

  // 2. Fallback to local file
  return readLocalRaffle();
}

export async function updateRaffleSettings(data: {
  id?: string;
  title: string;
  description: string;
  cutoffDate: string;
  prizes: string[];
  isActive?: boolean;
}): Promise<RaffleData> {
  const raffleId = data.id || "default";

  // 1. Try Neon DB
  try {
    const updated = await writeDbRaffleSettings(data);
    if (updated) {
      void writeLocalRaffle(updated);
      return updated;
    }
  } catch (err) {
    console.warn("Neon DB write error for raffle settings:", err);
  }

  // 2. Fallback to local file
  const local = await readLocalRaffle();
  const merged: RaffleData = {
    ...local,
    title: data.title,
    description: data.description,
    cutoffDate: data.cutoffDate,
    prizes: data.prizes,
    isActive: data.isActive !== undefined ? data.isActive : local.isActive,
    updatedAt: new Date().toISOString(),
  };
  await writeLocalRaffle(merged);
  return merged;
}

export async function submitRaffleEntry(
  raffleId = "default",
  fullName: string,
  deviceId?: string,
): Promise<{ success: boolean; entry?: RaffleEntry; updated?: boolean; error?: string }> {
  // 1. Try Neon DB
  try {
    const res = await submitOrUpdateDbRaffleEntry(raffleId, fullName, deviceId);
    if (res.success && res.entry) {
      // Sync local fallback
      const local = await readLocalRaffle();
      const existingIdx = local.entries.findIndex(
        (e) => (deviceId && e.deviceId === deviceId) || e.id === res.entry.id,
      );
      if (existingIdx !== -1) {
        local.entries[existingIdx] = {
          ...local.entries[existingIdx],
          fullName: res.entry.fullName,
        };
      } else {
        local.entries.push(res.entry);
      }
      void writeLocalRaffle(local);
      return res;
    }
    if (res.error) return res;
  } catch (err: any) {
    console.warn("Neon DB error submitting raffle entry:", err);
  }

  // 2. Fallback logic with local file
  const local = await readLocalRaffle();
  const trimmed = fullName.trim();
  if (!trimmed) return { success: false, error: "Please enter your full name." };

  if (!local.isActive) {
    return { success: false, error: "This raffle is currently inactive." };
  }
  if (local.cutoffDate && new Date().getTime() > new Date(local.cutoffDate).getTime()) {
    return { success: false, error: "The cut-off date for this raffle has passed. Entries are closed." };
  }

  // Check device existing
  if (deviceId) {
    const existingEntry = local.entries.find((e) => e.deviceId === deviceId);
    if (existingEntry) {
      existingEntry.fullName = trimmed;
      await writeLocalRaffle(local);
      return { success: true, updated: true, entry: existingEntry };
    }
  }

  // Check duplicate full name
  if (local.entries.some((e) => e.fullName.toLowerCase() === trimmed.toLowerCase())) {
    return { success: false, error: `"${trimmed}" is already registered in this raffle!` };
  }

  const newEntry: RaffleEntry = {
    id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fullName: trimmed,
    deviceId,
    createdAt: new Date().toISOString(),
  };
  local.entries.push(newEntry);
  await writeLocalRaffle(local);
  return { success: true, updated: false, entry: newEntry };
}

export async function setRaffleWinner(entryId: string, prizeWon: string | null): Promise<boolean> {
  // 1. Try Neon DB
  try {
    await assignDbRaffleWinner(entryId, prizeWon);
  } catch (err) {
    console.warn("Neon DB assign winner error:", err);
  }

  // 2. Always update local fallback
  const local = await readLocalRaffle();
  const entry = local.entries.find((e) => e.id === entryId);
  if (entry) {
    entry.prizeWon = prizeWon ? prizeWon.trim() : null;
    await writeLocalRaffle(local);
    return true;
  }
  return false;
}

export async function removeRaffleEntry(entryId: string): Promise<boolean> {
  // 1. Try Neon DB
  try {
    await deleteDbRaffleEntry(entryId);
  } catch (err) {
    console.warn("Neon DB delete entry error:", err);
  }

  // 2. Local fallback
  const local = await readLocalRaffle();
  local.entries = local.entries.filter((e) => e.id !== entryId);
  await writeLocalRaffle(local);
  return true;
}

export async function clearAllRaffleEntries(raffleId = "default"): Promise<boolean> {
  // 1. Try Neon DB
  try {
    await resetDbRaffleEntries(raffleId);
  } catch (err) {
    console.warn("Neon DB reset entries error:", err);
  }

  // 2. Local fallback
  const local = await readLocalRaffle();
  local.entries = [];
  await writeLocalRaffle(local);
  return true;
}

function localArchivesPath(): string {
  if (process.env.DATA_DIR) {
    return path.join(process.env.DATA_DIR, "raffle-archives.json");
  }
  if (process.env.VERCEL) {
    return path.join("/tmp", "raffle-archives.json");
  }
  return path.join(process.cwd(), "data", "raffle-archives.json");
}

async function readLocalArchives(): Promise<RaffleArchiveSummary[]> {
  try {
    const filePath = localArchivesPath();
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

async function writeLocalArchives(archives: RaffleArchiveSummary[]): Promise<void> {
  try {
    const filePath = localArchivesPath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(archives, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write local raffle archives fallback:", err);
  }
}

export async function getArchivedRaffles(): Promise<RaffleArchiveSummary[]> {
  try {
    const archives = await readDbArchivedRaffles();
    if (archives && archives.length > 0) {
      void writeLocalArchives(archives);
      return archives;
    }
  } catch (err) {
    console.warn("Neon DB read error for archived raffles:", err);
  }
  return readLocalArchives();
}

export async function archiveCurrentRaffle(
  raffleId = "default",
  newSettings?: { title?: string; description?: string; cutoffDate?: string; prizes?: string[] },
): Promise<{ success: boolean; newRaffle?: RaffleData }> {
  try {
    const current = await getRaffleState(raffleId);

    // 1. Try Neon DB archive
    try {
      await archiveDbRaffle(current.id);
    } catch (err) {
      console.warn("Neon DB error archiving raffle:", err);
    }

    // 2. Save archive summary to local archives fallback
    const localArchives = await readLocalArchives();
    const archiveItem: RaffleArchiveSummary = {
      id: current.id,
      title: current.title,
      description: current.description,
      cutoffDate: current.cutoffDate,
      prizes: current.prizes,
      createdAt: current.createdAt || new Date().toISOString(),
      entriesCount: current.entries.length,
      winners: current.entries
        .filter((e) => Boolean(e.prizeWon))
        .map((e) => ({ id: e.id, fullName: e.fullName, prizeWon: e.prizeWon! })),
    };
    const updatedArchives = [archiveItem, ...localArchives.filter((a) => a.id !== current.id)];
    await writeLocalArchives(updatedArchives);

    // 3. Create next active raffle edition
    const nextTitle = newSettings?.title || "Community Heroes Grand Raffle";
    const nextDesc =
      newSettings?.description ||
      "Enter your Full Name below to join the official Community Heroes giveaway! Winners will be announced after the cut-off date.";
    const nextCutoff =
      newSettings?.cutoffDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const nextPrizes =
      newSettings?.prizes && newSettings.prizes.length > 0
        ? newSettings.prizes
        : current.prizes && current.prizes.length > 0
          ? current.prizes
          : ["Starlight Card", "100 Diamonds", "100 Diamonds", "50 Diamonds"];

    let newRaffle: RaffleData | null = await createDbNewRaffle({
      title: nextTitle,
      description: nextDesc,
      cutoffDate: nextCutoff,
      prizes: nextPrizes,
    });

    if (!newRaffle) {
      // Local fallback creation
      newRaffle = {
        id: `raffle-${Date.now()}`,
        title: nextTitle,
        description: nextDesc,
        cutoffDate: nextCutoff,
        prizes: nextPrizes,
        isActive: true,
        isArchived: false,
        entries: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    await writeLocalRaffle(newRaffle);
    return { success: true, newRaffle };
  } catch (err) {
    console.error("Error archiving raffle:", err);
    return { success: false };
  }
}

export async function createNewRaffle(data: {
  title: string;
  description: string;
  cutoffDate: string;
  prizes: string[];
  isActive?: boolean;
}): Promise<RaffleData | null> {
  try {
    const created = await createDbNewRaffle(data);
    if (created) {
      void writeLocalRaffle(created);
      return created;
    }
  } catch (err) {
    console.error("Error creating new raffle in store:", err);
  }

  // Local fallback
  const fallback: RaffleData = {
    id: `raffle-${Date.now()}`,
    title: data.title,
    description: data.description,
    cutoffDate: data.cutoffDate,
    prizes: data.prizes,
    isActive: data.isActive !== undefined ? data.isActive : true,
    isArchived: false,
    entries: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeLocalRaffle(fallback);
  return fallback;
}

export async function deleteRaffle(
  raffleId: string,
): Promise<{ success: boolean; nextRaffle?: RaffleData }> {
  try {
    await deleteDbRaffle(raffleId);

    // Also remove from local archives if present
    const localArchives = await readLocalArchives();
    await writeLocalArchives(localArchives.filter((a) => a.id !== raffleId));

    // Get remaining active raffle or create default
    const next = await getRaffleState("latest");
    return { success: true, nextRaffle: next };
  } catch (err) {
    console.error("Error deleting raffle in store:", err);
    return { success: false };
  }
}

export async function deleteArchivedRaffle(archiveId: string): Promise<boolean> {
  try {
    await deleteDbRaffle(archiveId);
    const localArchives = await readLocalArchives();
    await writeLocalArchives(localArchives.filter((a) => a.id !== archiveId));
    return true;
  } catch (err) {
    console.error("Error deleting archived raffle in store:", err);
    return false;
  }
}

export async function restoreArchivedRaffle(
  archiveId: string,
): Promise<{ success: boolean; restoredRaffle?: RaffleData }> {
  try {
    await unarchiveDbRaffle(archiveId);
    const localArchives = await readLocalArchives();
    await writeLocalArchives(localArchives.filter((a) => a.id !== archiveId));
    const restored = await getRaffleState(archiveId);
    return { success: true, restoredRaffle: restored };
  } catch (err) {
    console.error("Error restoring archived raffle:", err);
    return { success: false };
  }
}

export async function editArchivedRaffle(
  archiveId: string,
  title: string,
  description: string,
): Promise<boolean> {
  try {
    await updateDbArchivedRaffle(archiveId, title, description);
    const localArchives = await readLocalArchives();
    const item = localArchives.find((a) => a.id === archiveId);
    if (item) {
      item.title = title;
      item.description = description;
      await writeLocalArchives(localArchives);
    }
    return true;
  } catch (err) {
    console.error("Error updating archived raffle in store:", err);
    return false;
  }
}


