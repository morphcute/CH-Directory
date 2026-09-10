import { neon } from "@neondatabase/serverless";
import type {
  AppState,
  RaffleActiveSummary,
  RaffleData,
  RaffleArchiveSummary,
  RafflePrizeItem,
} from "@/types";

const NEON_DEFAULT_URL =
  "postgresql://neondb_owner:npg_sf48HAgKjVFW@ep-purple-sky-b3f8vspb-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    NEON_DEFAULT_URL
  );
}

// In-memory caching layer to prevent Neon compute hour exhaustion on Free Tier
interface CacheItem<T> {
  data: T;
  timestamp: number;
}

let cachedState: CacheItem<AppState> | null = null;
const STATE_CACHE_TTL_MS = 60_000; // 60 seconds TTL

const cachedRaffles = new Map<string, CacheItem<RaffleData>>();
const RAFFLE_CACHE_TTL_MS = 30_000; // 30 seconds TTL

let cachedActiveRaffles: CacheItem<RaffleActiveSummary[]> | null = null;

let cachedArchives: CacheItem<RaffleArchiveSummary[]> | null = null;
const ARCHIVES_CACHE_TTL_MS = 60_000; // 60 seconds TTL

export function clearDbCache(type?: "state" | "raffle" | "archives" | "all") {
  if (!type || type === "all") {
    cachedState = null;
    cachedRaffles.clear();
    cachedActiveRaffles = null;
    cachedArchives = null;
  } else if (type === "state") {
    cachedState = null;
  } else if (type === "raffle") {
    cachedRaffles.clear();
    cachedActiveRaffles = null;
  } else if (type === "archives") {
    cachedArchives = null;
  }
}

let initialized = false;

function getSql() {
  const url = getDatabaseUrl();
  if (!url) return null;
  return neon(url);
}

async function ensureTable(sql: any) {
  if (initialized) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS app_state (
        id VARCHAR(50) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    initialized = true;
  } catch {
    // Non-critical if table already exists or read-only
  }
}

export async function readDbState(): Promise<AppState | null> {
  if (cachedState && Date.now() - cachedState.timestamp < STATE_CACHE_TTL_MS) {
    return cachedState.data;
  }

  const sql = getSql();
  if (!sql) return null;
  try {
    await ensureTable(sql);
    const rows = await sql`
      SELECT data FROM app_state WHERE id = 'default' LIMIT 1;
    `;
    if (rows && rows.length > 0 && rows[0].data) {
      const data = rows[0].data as AppState;
      cachedState = { data, timestamp: Date.now() };
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeDbState(state: AppState): Promise<boolean> {
  cachedState = { data: state, timestamp: Date.now() };

  const sql = getSql();
  if (!sql) return false;
  try {
    await ensureTable(sql);
    await sql`
      INSERT INTO app_state (id, data, updated_at)
      VALUES ('default', ${JSON.stringify(state)}::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP;
    `;
    return true;
  } catch {
    return false;
  }
}

export async function incrementPageViewsDb(): Promise<number | null> {
  // Compute Optimization: Do not update Neon database on visitor page views.
  // This allows Neon free tier to auto-suspend when inactive and not burn compute hours.
  return null;
}

let raffleTablesInitialized = false;

async function ensureRaffleTables(sql: any) {
  if (raffleTablesInitialized) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS raffles (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        cutoff_date TIMESTAMP WITH TIME ZONE,
        prizes JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS raffle_entries (
        id VARCHAR(50) PRIMARY KEY,
        raffle_id VARCHAR(50) NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
        full_name VARCHAR(150) NOT NULL,
        device_id VARCHAR(100),
        ip_address VARCHAR(100),
        prize_won VARCHAR(150),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_raffle_entries_raffle_id ON raffle_entries(raffle_id);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_raffle_entries_device_id ON raffle_entries(device_id);
    `;
    try {
      await sql`ALTER TABLE raffle_entries ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_raffle_entries_ip_address ON raffle_entries(raffle_id, ip_address);`;
    } catch {
      // Column may already exist
    }
    try {
      await sql`ALTER TABLE raffle_entries ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(100);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_raffle_entries_fingerprint ON raffle_entries(raffle_id, fingerprint);`;
    } catch {
      // Column may already exist
    }
    raffleTablesInitialized = true;
  } catch {
    // Non-critical if tables already exist
  }
}

export async function readDbRaffle(raffleId = "default"): Promise<RaffleData | null> {
  const cacheKey = raffleId || "default";
  const hit = cachedRaffles.get(cacheKey);
  if (hit && Date.now() - hit.timestamp < RAFFLE_CACHE_TTL_MS) {
    return hit.data;
  }

  const sql = getSql();
  if (!sql) return null;
  try {
    await ensureRaffleTables(sql);

    let raffleRows;
    if (raffleId === "default" || raffleId === "latest") {
      raffleRows = await sql`
        SELECT id, title, category, description, cutoff_date, prizes, is_active, is_archived, created_at, updated_at
        FROM raffles
        WHERE is_archived = false
        ORDER BY created_at DESC
        LIMIT 1;
      `;
    } else {
      raffleRows = await sql`
        SELECT id, title, category, description, cutoff_date, prizes, is_active, is_archived, created_at, updated_at
        FROM raffles
        WHERE id = ${raffleId}
        LIMIT 1;
      `;
    }

    if (!raffleRows || raffleRows.length === 0) {
      const newId = raffleId === "default" || raffleId === "latest" ? "default" : raffleId;
      const defaultCutoff = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const defaultPrizes = [
        { name: "100 Diamonds", winnerCount: 5 },
        { name: "Starlight Card", winnerCount: 1 },
      ];
      await sql`
        INSERT INTO raffles (id, title, category, description, cutoff_date, prizes, is_active, is_archived)
        VALUES (
          ${newId},
          'Community Heroes Grand Raffle',
          'Diamonds Giveaway',
          'Enter your Full Name below to join the official Community Heroes giveaway! Winners will be announced after the cut-off date.',
          ${defaultCutoff},
          ${JSON.stringify(defaultPrizes)}::jsonb,
          true,
          false
        )
        ON CONFLICT (id) DO NOTHING;
      `;
      const freshDefault: RaffleData = {
        id: newId,
        title: "Community Heroes Grand Raffle",
        category: "Diamonds Giveaway",
        description:
          "Enter your Full Name below to join the official Community Heroes giveaway! Winners will be announced after the cut-off date.",
        cutoffDate: defaultCutoff,
        prizes: defaultPrizes,
        isActive: true,
        isArchived: false,
        entries: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      cachedRaffles.set(cacheKey, { data: freshDefault, timestamp: Date.now() });
      return freshDefault;
    }

    const r = raffleRows[0];
    const entryRows = await sql`
      SELECT id, raffle_id, raffle_title, category, full_name, device_id, ip_address, fingerprint, prize_won, created_at, updated_at
      FROM raffle_entries
      WHERE raffle_id = ${r.id}
      ORDER BY created_at ASC;
    `;

    const raffleResult: RaffleData = {
      id: r.id,
      title: r.title,
      category: r.category || "Diamonds Giveaway",
      description: r.description,
      cutoffDate: r.cutoff_date ? new Date(r.cutoff_date).toISOString() : "",
      prizes: Array.isArray(r.prizes) ? r.prizes : [],
      isActive: r.is_active,
      isArchived: Boolean(r.is_archived),
      entries: entryRows.map((entry: any) => ({
        id: entry.id,
        raffleId: entry.raffle_id || r.id,
        raffleTitle: entry.raffle_title || r.title,
        category: entry.category || r.category || "Diamonds Giveaway",
        fullName: entry.full_name,
        deviceId: entry.device_id || undefined,
        ipAddress: entry.ip_address || undefined,
        fingerprint: entry.fingerprint || undefined,
        prizeWon: entry.prize_won || null,
        createdAt: entry.created_at ? new Date(entry.created_at).toISOString() : new Date().toISOString(),
      })),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    };

    cachedRaffles.set(cacheKey, { data: raffleResult, timestamp: Date.now() });
    cachedRaffles.set(r.id, { data: raffleResult, timestamp: Date.now() });
    return raffleResult;
  } catch {
    return null;
  }
}

export async function readDbActiveRaffles(): Promise<RaffleActiveSummary[] | null> {
  if (
    cachedActiveRaffles &&
    Date.now() - cachedActiveRaffles.timestamp < RAFFLE_CACHE_TTL_MS
  ) {
    return cachedActiveRaffles.data;
  }

  const sql = getSql();
  if (!sql) return null;
  try {
    await ensureRaffleTables(sql);
    const rows = await sql`
      SELECT
        r.id,
        r.title,
        r.category,
        r.description,
        r.cutoff_date,
        r.prizes,
        r.is_active,
        r.created_at,
        COUNT(e.id)::int AS entries_count
      FROM raffles r
      LEFT JOIN raffle_entries e ON e.raffle_id = r.id
      WHERE r.is_archived = false AND r.is_active = true
      GROUP BY r.id
      ORDER BY r.created_at DESC;
    `;

    const activeRaffles = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category || "Diamonds Giveaway",
      description: row.description || "",
      cutoffDate: row.cutoff_date
        ? new Date(row.cutoff_date).toISOString()
        : "",
      prizes: Array.isArray(row.prizes) ? row.prizes : [],
      isActive: Boolean(row.is_active),
      entriesCount: Number(row.entries_count) || 0,
      createdAt: row.created_at
        ? new Date(row.created_at).toISOString()
        : new Date().toISOString(),
    }));

    cachedActiveRaffles = {
      data: activeRaffles,
      timestamp: Date.now(),
    };
    return activeRaffles;
  } catch {
    return null;
  }
}

export async function readDbArchivedRaffles(): Promise<RaffleArchiveSummary[]> {
  if (cachedArchives && Date.now() - cachedArchives.timestamp < ARCHIVES_CACHE_TTL_MS) {
    return cachedArchives.data;
  }

  const sql = getSql();
  if (!sql) return [];
  try {
    await ensureRaffleTables(sql);
    const rows = await sql`
      SELECT id, title, description, cutoff_date, prizes, created_at
      FROM raffles
      WHERE is_archived = true
      ORDER BY created_at DESC;
    `;
    if (!rows || rows.length === 0) {
      cachedArchives = { data: [], timestamp: Date.now() };
      return [];
    }

    const result: RaffleArchiveSummary[] = [];
    for (const r of rows) {
      const winnerRows = await sql`
        SELECT id, full_name, prize_won
        FROM raffle_entries
        WHERE raffle_id = ${r.id} AND prize_won IS NOT NULL AND TRIM(prize_won) != ''
        ORDER BY updated_at ASC;
      `;
      const countRes = await sql`
        SELECT COUNT(*) as count FROM raffle_entries WHERE raffle_id = ${r.id};
      `;
      const count = countRes && countRes[0] ? Number(countRes[0].count) : 0;

      result.push({
        id: r.id,
        title: r.title,
        description: r.description,
        cutoffDate: r.cutoff_date ? new Date(r.cutoff_date).toISOString() : "",
        prizes: Array.isArray(r.prizes) ? r.prizes : [],
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        entriesCount: count,
        winners: winnerRows.map((w: any) => ({
          id: w.id,
          fullName: w.full_name,
          prizeWon: w.prize_won,
        })),
      });
    }

    cachedArchives = { data: result, timestamp: Date.now() };
    return result;
  } catch {
    return [];
  }
}

export async function archiveDbRaffle(raffleId: string): Promise<boolean> {
  clearDbCache("raffle");
  clearDbCache("archives");

  const sql = getSql();
  if (!sql) return false;
  try {
    await ensureRaffleTables(sql);
    await sql`
      UPDATE raffles
      SET is_archived = true, is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${raffleId};
    `;
    return true;
  } catch {
    return false;
  }
}

export async function unarchiveDbRaffle(raffleId: string): Promise<boolean> {
  clearDbCache("raffle");
  clearDbCache("archives");

  const sql = getSql();
  if (!sql) return false;
  try {
    await ensureRaffleTables(sql);
    await sql`
      UPDATE raffles
      SET is_archived = false, is_active = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${raffleId};
    `;
    return true;
  } catch {
    return false;
  }
}

export async function updateDbArchivedRaffle(raffleId: string, title: string, description: string): Promise<boolean> {
  clearDbCache("archives");

  const sql = getSql();
  if (!sql) return false;
  try {
    await ensureRaffleTables(sql);
    await sql`
      UPDATE raffles
      SET title = ${title}, description = ${description}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${raffleId};
    `;
    return true;
  } catch {
    return false;
  }
}

export async function deleteDbRaffle(raffleId: string): Promise<boolean> {
  clearDbCache("raffle");
  clearDbCache("archives");

  const sql = getSql();
  if (!sql) return false;
  try {
    await ensureRaffleTables(sql);
    await sql`DELETE FROM raffle_entries WHERE raffle_id = ${raffleId};`;
    await sql`DELETE FROM raffles WHERE id = ${raffleId};`;
    return true;
  } catch {
    return false;
  }
}

export async function createDbNewRaffle(data: {
  title: string;
  category?: string;
  description: string;
  cutoffDate: string;
  prizes: (string | RafflePrizeItem)[];
  isActive?: boolean;
}): Promise<RaffleData | null> {
  clearDbCache("raffle");
  clearDbCache("archives");

  const sql = getSql();
  if (!sql) return null;
  const newId = `raffle-${Date.now()}`;
  try {
    await ensureRaffleTables(sql);
    await sql`
      INSERT INTO raffles (id, title, category, description, cutoff_date, prizes, is_active, is_archived, created_at, updated_at)
      VALUES (
        ${newId},
        ${data.title},
        ${data.category || "Diamonds Giveaway"},
        ${data.description},
        ${data.cutoffDate ? new Date(data.cutoffDate) : null},
        ${JSON.stringify(data.prizes)}::jsonb,
        ${data.isActive !== undefined ? data.isActive : true},
        false,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `;
    return readDbRaffle(newId);
  } catch {
    return null;
  }
}

export async function writeDbRaffleSettings(data: {
  id?: string;
  title: string;
  category?: string;
  description: string;
  cutoffDate: string;
  prizes: (string | RafflePrizeItem)[];
  isActive?: boolean;
}): Promise<RaffleData | null> {
  clearDbCache("raffle");

  const sql = getSql();
  if (!sql) return null;
  let raffleId = data.id;
  if (!raffleId || raffleId === "latest" || raffleId === "default") {
    try {
      await ensureRaffleTables(sql);
      const activeRows = await sql`
        SELECT id FROM raffles WHERE is_archived = false ORDER BY created_at DESC LIMIT 1;
      `;
      if (activeRows && activeRows.length > 0) {
        raffleId = activeRows[0].id;
      } else {
        raffleId = "default";
      }
    } catch {
      raffleId = "default";
    }
  }

  try {
    await ensureRaffleTables(sql);
    await sql`
      INSERT INTO raffles (id, title, category, description, cutoff_date, prizes, is_active, is_archived, updated_at)
      VALUES (
        ${raffleId},
        ${data.title},
        ${data.category || "Diamonds Giveaway"},
        ${data.description},
        ${data.cutoffDate ? new Date(data.cutoffDate) : null},
        ${JSON.stringify(data.prizes)}::jsonb,
        ${data.isActive !== undefined ? data.isActive : true},
        false,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE
      SET
        title = EXCLUDED.title,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        cutoff_date = EXCLUDED.cutoff_date,
        prizes = EXCLUDED.prizes,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP;
    `;
    return readDbRaffle(raffleId);
  } catch {
    return null;
  }
}

function isSameIp(ipA?: string, ipB?: string): boolean {
  if (!ipA || !ipB) return false;
  const cleanA = ipA.trim().toLowerCase().replace(/^::ffff:/, "");
  const cleanB = ipB.trim().toLowerCase().replace(/^::ffff:/, "");
  const normA = cleanA === "::1" || cleanA === "localhost" ? "127.0.0.1" : cleanA;
  const normB = cleanB === "::1" || cleanB === "localhost" ? "127.0.0.1" : cleanB;
  if (normA === normB) return true;
  if (normA.includes(":") && normB.includes(":")) {
    const prefixA = normA.split(":").slice(0, 4).join(":");
    const prefixB = normB.split(":").slice(0, 4).join(":");
    if (prefixA && prefixB && prefixA === prefixB) return true;
  }
  return false;
}

export async function submitOrUpdateDbRaffleEntry(
  raffleId = "default",
  fullName: string,
  deviceId?: string,
  clientIp?: string,
  fingerprint?: string,
): Promise<{ success: boolean; entry?: any; updated?: boolean; error?: string }> {
  clearDbCache("raffle");

  const sql = getSql();
  if (!sql) return { success: false, error: "Database not connected" };

  const trimmed = fullName.trim();
  if (!trimmed) return { success: false, error: "Please enter your full name." };

  try {
    await ensureRaffleTables(sql);

    let raffleRows;
    if (raffleId === "default" || raffleId === "latest") {
      raffleRows = await sql`
        SELECT id, title, category, cutoff_date, is_active FROM raffles WHERE is_archived = false ORDER BY created_at DESC LIMIT 1;
      `;
    } else {
      raffleRows = await sql`
        SELECT id, title, category, cutoff_date, is_active FROM raffles WHERE id = ${raffleId} LIMIT 1;
      `;
    }

    if (!raffleRows || raffleRows.length === 0) {
      return { success: false, error: "Raffle not found." };
    }
    const { id: actualRaffleId, title: actualTitle, category: rawCategory, cutoff_date, is_active } = raffleRows[0];
    const actualCategory = rawCategory || "Diamonds Giveaway";

    if (!is_active) {
      return { success: false, error: "This raffle is currently inactive." };
    }
    if (cutoff_date && new Date().getTime() > new Date(cutoff_date).getTime()) {
      return {
        success: false,
        error: "The cut-off date for this raffle has passed. Entries are closed.",
      };
    }

    let existingEntry: any = null;
    let matchedByDevice = false;

    // 1. Check deviceId (stored in browser cookie / localStorage)
    if (deviceId) {
      const deviceEntry = await sql`
        SELECT id, raffle_id, raffle_title, category, full_name, device_id, ip_address, prize_won, created_at
        FROM raffle_entries
        WHERE raffle_id = ${actualRaffleId} AND device_id = ${deviceId}
        LIMIT 1;
      `;
      if (deviceEntry && deviceEntry.length > 0) {
        const registeredIp = deviceEntry[0].ip_address;
        // Verify registered IP matches client IP if recorded.
        // If IP does not match, the device token is from another network (e.g. cross-contaminated or session hijacked).
        if (!registeredIp || !clientIp || isSameIp(registeredIp, clientIp)) {
          existingEntry = deviceEntry[0];
          matchedByDevice = true;
        } else {
          // IP mismatch: discard old deviceId to assign a fresh clean deviceId
          deviceId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        }
      }
    }

    // 2. Check client IP (to prevent multiple entries from the same network)
    if (!existingEntry && clientIp) {
      let ipEntry;
      if (clientIp.includes(":")) {
        const ipv6Prefix = clientIp.split(":").slice(0, 4).join(":") + ":%";
        ipEntry = await sql`
          SELECT id, raffle_id, raffle_title, category, full_name, device_id, ip_address, prize_won, created_at
          FROM raffle_entries
          WHERE raffle_id = ${actualRaffleId} AND (ip_address = ${clientIp} OR ip_address LIKE ${ipv6Prefix})
          LIMIT 1;
        `;
      } else {
        ipEntry = await sql`
          SELECT id, raffle_id, raffle_title, category, full_name, device_id, ip_address, prize_won, created_at
          FROM raffle_entries
          WHERE raffle_id = ${actualRaffleId} AND ip_address = ${clientIp}
          LIMIT 1;
        `;
      }
      if (ipEntry && ipEntry.length > 0) {
        existingEntry = ipEntry[0];
        matchedByDevice = false;
      }
    }

    if (existingEntry) {
      // If found by IP only (different browser/device on same network)
      if (!matchedByDevice) {
        return {
          success: false,
          error: `Only 1 entry is allowed per network / IP. An entry has already been registered under "${existingEntry.full_name}".`,
        };
      }

      // Check if duplicate full name exists for ANOTHER entry in this raffle
      const existingOtherName = await sql`
        SELECT id FROM raffle_entries
        WHERE raffle_id = ${actualRaffleId} AND LOWER(TRIM(full_name)) = LOWER(${trimmed}) AND id != ${existingEntry.id}
        LIMIT 1;
      `;
      if (existingOtherName && existingOtherName.length > 0) {
        return { success: false, error: `"${trimmed}" is already registered in this raffle!` };
      }

      const existingEntryId = existingEntry.id;
      const updateRes = await sql`
        UPDATE raffle_entries
        SET full_name = ${trimmed},
            raffle_title = ${actualTitle},
            category = ${actualCategory},
            device_id = COALESCE(${deviceId || null}, device_id),
            ip_address = COALESCE(${clientIp || null}, ip_address),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existingEntryId}
        RETURNING id, raffle_id, raffle_title, category, full_name, device_id, ip_address, prize_won, created_at;
      `;
      const u = updateRes[0];
      return {
        success: true,
        updated: true,
        entry: {
          id: u.id,
          raffleId: u.raffle_id || actualRaffleId,
          raffleTitle: u.raffle_title || actualTitle,
          category: u.category || actualCategory,
          fullName: u.full_name,
          deviceId: u.device_id || deviceId || undefined,
          ipAddress: u.ip_address || clientIp || undefined,
          prizeWon: u.prize_won || null,
          createdAt: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
        },
      };
    }

    const existingName = await sql`
      SELECT id FROM raffle_entries
      WHERE raffle_id = ${actualRaffleId} AND LOWER(TRIM(full_name)) = LOWER(${trimmed})
      LIMIT 1;
    `;
    if (existingName && existingName.length > 0) {
      return {
        success: false,
        error: `"${trimmed}" is already registered in this raffle!`,
      };
    }

    const entryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const result = await sql`
      INSERT INTO raffle_entries (id, raffle_id, raffle_title, category, full_name, device_id, ip_address, fingerprint)
      VALUES (${entryId}, ${actualRaffleId}, ${actualTitle}, ${actualCategory}, ${trimmed}, ${deviceId || null}, ${clientIp || null}, ${fingerprint || null})
      RETURNING id, raffle_id, raffle_title, category, full_name, device_id, ip_address, fingerprint, prize_won, created_at;
    `;

    if (result && result.length > 0) {
      const e = result[0];
      return {
        success: true,
        updated: false,
        entry: {
          id: e.id,
          raffleId: e.raffle_id || actualRaffleId,
          raffleTitle: e.raffle_title || actualTitle,
          category: e.category || actualCategory,
          fullName: e.full_name,
          deviceId: e.device_id || deviceId || undefined,
          ipAddress: e.ip_address || clientIp || undefined,
          prizeWon: e.prize_won || null,
          createdAt: e.created_at ? new Date(e.created_at).toISOString() : new Date().toISOString(),
        },
      };
    }
    return { success: false, error: "Could not save entry." };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit raffle entry." };
  }
}

export async function assignDbRaffleWinner(entryId: string, prizeWon: string | null): Promise<boolean> {
  clearDbCache("raffle");
  clearDbCache("archives");

  const sql = getSql();
  if (!sql) return false;
  try {
    await ensureRaffleTables(sql);
    await sql`
      UPDATE raffle_entries
      SET prize_won = ${prizeWon ? prizeWon.trim() : null}
      WHERE id = ${entryId};
    `;
    return true;
  } catch {
    return false;
  }
}

export async function deleteDbRaffleEntry(entryId: string): Promise<boolean> {
  clearDbCache("raffle");

  const sql = getSql();
  if (!sql) return false;
  try {
    await ensureRaffleTables(sql);
    await sql`
      DELETE FROM raffle_entries WHERE id = ${entryId};
    `;
    return true;
  } catch {
    return false;
  }
}

export async function resetDbRaffleEntries(raffleId = "default"): Promise<boolean> {
  clearDbCache("raffle");

  const sql = getSql();
  if (!sql) return false;
  try {
    await ensureRaffleTables(sql);
    await sql`
      DELETE FROM raffle_entries WHERE raffle_id = ${raffleId};
    `;
    return true;
  } catch {
    return false;
  }
}
