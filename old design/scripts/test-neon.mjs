import { neon } from "@neondatabase/serverless";

const dbUrl = "postgresql://neondb_owner:npg_sf48HAgKjVFW@ep-purple-sky-b3f8vspb-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  try {
    const sql = neon(dbUrl);
    const rows = await sql`SELECT data, updated_at FROM app_state WHERE id = 'default' LIMIT 1;`;
    if (rows && rows.length > 0) {
      const s = rows[0].data;
      console.log("Neon DB updated_at:", rows[0].updated_at);
      console.log("Total players:", s.players?.length);
      console.log("Active players:", s.players?.filter((p) => p.active).length);
      console.log("Inactive players:", s.players?.filter((p) => !p.active).length);
      console.log("Active nicknames:", s.players?.filter((p) => p.active).map((p) => p.chNickname));
      console.log("Inactive nicknames:", s.players?.filter((p) => !p.active).map((p) => p.chNickname));
      console.log("logoUrl:", s.logoUrl?.slice(0, 80));
      console.log("bannerUrl:", s.bannerUrl?.slice(0, 80));
      console.log("bannerSettings:", s.bannerSettings);
    } else {
      console.log("app_state table is empty in Neon DB");
    }
  } catch (err) {
    console.error("Neon DB error:", err);
  }
}

main();
