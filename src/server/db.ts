import { neon } from "@neondatabase/serverless";
import type { AppState, RaffleData, RaffleArchiveSummary, RafflePrizeItem } from "@/types";

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
  } catch (err) {
    console.error("Failed to ensure app_state table:", err);
  }
}

export async function readDbState(): Promise<AppState | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    await ensureTable(sql);
    const rows = await sql`
      SELECT data FROM app_state WHERE id = 'default' LIMIT 1;
    `;
    if (rows && rows.length > 0 && rows[0].data) {
      return rows[0].data as AppState;
    }
    return null;
  } catch (err) {
    console.error("Error reading state from Neon database:", err);
    return null;
  }
}

export async function writeDbState(state: AppState): Promise<boolean> {
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
  } catch (err) {
    console.error("Error writing state to Neon database:", err);
    return false;
  }
}

export async function incrementPageViewsDb(): Promise<number | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    await ensureTable(sql);
    const rows = await sql`
      UPDATE app_state
      SET data = jsonb_set(
        data,
        '{pageViews}',
        to_jsonb(COALESCE((data->>'pageViews')::int, 0) + 1)
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE id = 'default'
      RETURNING (data->>'pageViews')::int AS page_views;
    `;
    if (rows && rows.length > 0 && typeof rows[0].page_views === "number") {
      return rows[0].page_views;
    }
    return null;
  } catch (err) {
    console.error("Error incrementing pageViews in Neon:", err);
    return null;
  }
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
    await sql`
      ALTER TABLE raffle_entries ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
    `;
    await sql`ALTER TABLE raffle_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`;
    await sql`ALTER TABLE raffles ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;`;
    await sql`ALTER TABLE raffles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`;
    await sql`ALTER TABLE raffle_entries ADD COLUMN IF NOT EXISTS raffle_title VARCHAR(255);`;
    await sql`ALTER TABLE raffle_entries ADD COLUMN IF NOT EXISTS category VARCHAR(100);`;
    await sql`ALTER TABLE raffles ADD COLUMN IF NOT EXISTS category VARCHAR(100);`;
    raffleTablesInitialized = true;
  } catch (err) {
    console.error("Failed to ensure raffle tables:", err);
  }
}

export async function readDbRaffle(raffleId = "default"): Promise<RaffleData | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    await ensureRaffleTables(sql);

    let raffleRows;
    if (raffleId === "default" || raffleId === "latest") {
      // Find the most recent unarchived raffle
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
      // Initialize default raffle
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
      return {
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
    }

    const r = raffleRows[0];
    const entryRows = await sql`
      SELECT id, raffle_id, raffle_title, category, full_name, device_id, prize_won, created_at, updated_at
      FROM raffle_entries
      WHERE raffle_id = ${r.id}
      ORDER BY created_at ASC;
    `;

    return {
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
        prizeWon: entry.prize_won || null,
        createdAt: entry.created_at ? new Date(entry.created_at).toISOString() : new Date().toISOString(),
      })),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    };
  } catch (err) {
    console.error("Error reading raffle from Neon database:", err);
    return null;
  }
}

export async function readDbArchivedRaffles() {
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
    if (!rows || rows.length === 0) return [];

    const result = [];
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
    return result;
  } catch (err) {
    console.error("Error reading archived raffles from Neon:", err);
    return [];
  }
}

export async function archiveDbRaffle(raffleId: string) {
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
  } catch (err) {
    console.error("Error archiving raffle in Neon:", err);
    return false;
  }
}

export async function unarchiveDbRaffle(raffleId: string) {
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
  } catch (err) {
    console.error("Error unarchiving raffle in Neon:", err);
    return false;
  }
}

export async function updateDbArchivedRaffle(raffleId: string, title: string, description: string) {
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
  } catch (err) {
    console.error("Error updating archived raffle in Neon:", err);
    return false;
  }
}

export async function deleteDbRaffle(raffleId: string) {
  const sql = getSql();
  if (!sql) return false;
  try {
    await ensureRaffleTables(sql);
    await sql`DELETE FROM raffle_entries WHERE raffle_id = ${raffleId};`;
    await sql`DELETE FROM raffles WHERE id = ${raffleId};`;
    return true;
  } catch (err) {
    console.error("Error deleting raffle in Neon:", err);
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
}) {
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
  } catch (err) {
    console.error("Error creating new raffle in Neon:", err);
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
}) {
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
  } catch (err) {
    console.error("Error writing raffle settings to Neon:", err);
    return null;
  }
}

export async function submitOrUpdateDbRaffleEntry(
  raffleId = "default",
  fullName: string,
  deviceId?: string,
): Promise<{ success: boolean; entry?: any; updated?: boolean; error?: string }> {
  const sql = getSql();
  if (!sql) return { success: false, error: "Database not connected" };

  const trimmed = fullName.trim();
  if (!trimmed) return { success: false, error: "Please enter your full name." };

  try {
    await ensureRaffleTables(sql);

    // 1. Check raffle status & cut-off date, and resolve actual raffleId/title/category
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

    // 2. If deviceId is provided, check if this device already has an entry
    if (deviceId) {
      const deviceEntry = await sql`
        SELECT id, raffle_id, raffle_title, category, full_name, prize_won, created_at
        FROM raffle_entries
        WHERE raffle_id = ${actualRaffleId} AND device_id = ${deviceId}
        LIMIT 1;
      `;

      if (deviceEntry && deviceEntry.length > 0) {
        // Device already has an entry -> EDIT/UPDATE IT!
        const existingEntryId = deviceEntry[0].id;
        const updateRes = await sql`
          UPDATE raffle_entries
          SET full_name = ${trimmed}, raffle_title = ${actualTitle}, category = ${actualCategory}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${existingEntryId}
          RETURNING id, raffle_id, raffle_title, category, full_name, prize_won, created_at;
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
            prizeWon: u.prize_won || null,
            createdAt: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
          },
        };
      }
    }

    // 3. Prevent duplicate full names (case-insensitive)
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

    // 4. Insert new entry with raffle_title and category
    const entryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const result = await sql`
      INSERT INTO raffle_entries (id, raffle_id, raffle_title, category, full_name, device_id)
      VALUES (${entryId}, ${actualRaffleId}, ${actualTitle}, ${actualCategory}, ${trimmed}, ${deviceId || null})
      RETURNING id, raffle_id, raffle_title, category, full_name, prize_won, created_at;
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
          prizeWon: e.prize_won || null,
          createdAt: e.created_at ? new Date(e.created_at).toISOString() : new Date().toISOString(),
        },
      };
    }
    return { success: false, error: "Could not save entry." };
  } catch (err: any) {
    console.error("Error submitting raffle entry in Neon:", err);
    return { success: false, error: err.message || "Failed to submit raffle entry." };
  }
}


export async function assignDbRaffleWinner(entryId: string, prizeWon: string | null) {
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
  } catch (err) {
    console.error("Error assigning raffle winner in Neon:", err);
    return false;
  }
}

export async function deleteDbRaffleEntry(entryId: string) {
  const sql = getSql();
  if (!sql) return false;
  try {
    await ensureRaffleTables(sql);
    await sql`
      DELETE FROM raffle_entries WHERE id = ${entryId};
    `;
    return true;
  } catch (err) {
    console.error("Error deleting raffle entry in Neon:", err);
    return false;
  }
}

export async function resetDbRaffleEntries(raffleId = "default") {
  const sql = getSql();
  if (!sql) return false;
  try {
    await ensureRaffleTables(sql);
    await sql`
      DELETE FROM raffle_entries WHERE raffle_id = ${raffleId};
    `;
    return true;
  } catch (err) {
    console.error("Error resetting raffle entries in Neon:", err);
    return false;
  }
}

