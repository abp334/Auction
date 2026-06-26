/**
 * One-time migration: add auctions.isTest column.
 * Run: cd server && npx tsx scripts/add-isTest-column.ts
 */
import "dotenv/config";
import pg from "pg";

const sql = `
ALTER TABLE auctions
ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;
`;

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL or DIRECT_URL in server/.env");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: url });
  try {
    await pool.query(sql);
    console.log("OK: auctions.isTest column ready");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
