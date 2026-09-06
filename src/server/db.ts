import { neon } from "@neondatabase/serverless";
import type { AppState } from "@/types";

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
