/**
 * Read-only snapshot of the Supabase projection.
 *
 * Why this exists: beyond the RPC retention window (~7 days on testnet) the chain
 * can no longer serve the events the projection was built from, so "just replay it"
 * stops being a recovery plan. As of the first run, ~70% of the rows were already
 * below the retention floor — a replay would not bring them back. This writes the
 * current state to disk so it survives independently of both Supabase and the RPC.
 *
 * Strictly read-only: SELECTs only, never writes to the database.
 *
 * Output: backups/projection-<UTC timestamp>.json (gitignored — it contains
 * wallet addresses and is operational data, not source).
 *
 * Run from repo root:
 *   node_modules/.pnpm/node_modules/.bin/tsx apps/web/scripts/snapshot-projection.ts
 *
 * Restore sketch: the file is a plain { table: rows[] } map. Restoring means
 * inserting the rows back with the service role (RLS blocks anon writes), in FK
 * order — artists, tokens, listings, sales, token_transfers — which is the order
 * they appear in the file.
 */

import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

config({ path: resolve(import.meta.dirname, "../../../.env") });

/** FK order: parents first, so the file can be replayed top to bottom. */
const TABLES = ["artists", "tokens", "listings", "sales", "token_transfers"] as const;

const OUT_DIR = resolve(import.meta.dirname, "../../../backups");

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env");

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const snapshot: Record<string, unknown[]> = {};
  let total = 0;

  for (const table of TABLES) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*`, { headers });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as unknown[];
    snapshot[table] = rows;
    total += rows.length;
    console.log(`  ${table.padEnd(16)} ${rows.length} rows`);
  }

  // Record where the RPC window sat when this ran: rows below this ledger were
  // already unrecoverable from the chain at snapshot time.
  let retentionFloor: number | null = null;
  try {
    const health = await fetch("https://molotov-web.vercel.app/api/indexer/health");
    if (health.ok) retentionFloor = (await health.json()).retentionFloorLedger ?? null;
  } catch {
    /* health is a nice-to-have, not a reason to fail the snapshot */
  }

  const takenAt = new Date().toISOString();
  const payload = {
    takenAt,
    retentionFloorLedger: retentionFloor,
    note: "Read-only snapshot of the Supabase projection. Rows below retentionFloorLedger were already unrecoverable from the chain when this was taken.",
    tables: snapshot,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const file = resolve(OUT_DIR, `projection-${takenAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2));

  console.log(`\n  ${total} rows total`);
  if (retentionFloor) console.log(`  RPC retention floor at snapshot: ledger ${retentionFloor}`);
  console.log(`  written to ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
