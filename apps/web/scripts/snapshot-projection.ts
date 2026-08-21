/**
 * Read-only snapshot of the Supabase projection — local/manual entry point.
 *
 * Why this exists: beyond the RPC retention window (~7 days on testnet) the chain
 * can no longer serve the events the projection was built from, so "just replay it"
 * stops being a recovery plan. This writes the current state to disk so it survives
 * independently of both Supabase and the RPC.
 *
 * The scheduled path is GET /api/backup (apps/web/app/api/backup/route.ts), which
 * shares this same logic (apps/web/lib/backup.ts) — this script is for a manual,
 * ad-hoc snapshot without going through the deployed app.
 *
 * Output: backups/projection-<UTC timestamp>.json (gitignored — it contains
 * wallet addresses and is operational data, not source).
 *
 * Run from repo root:
 *   pnpm --filter=web backup:snapshot
 *
 * To restore: apps/web/scripts/restore-projection.ts. See doc/indexer-operations.md
 * for the full procedure.
 */

import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

config({ path: resolve(import.meta.dirname, "../../../.env") });

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env");
  }

  // Imported after the env is loaded above: apps/api/indexer/config.ts reads
  // these at module init.
  const { buildProjectionSnapshot } = await import("../lib/backup");
  const snapshot = await buildProjectionSnapshot();

  let total = 0;
  for (const [table, rows] of Object.entries(snapshot.tables)) {
    total += rows.length;
    console.log(`  ${table.padEnd(16)} ${rows.length} rows`);
  }

  const outDir = resolve(import.meta.dirname, "../../../backups");
  mkdirSync(outDir, { recursive: true });
  const file = resolve(outDir, `projection-${snapshot.takenAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(snapshot, null, 2));

  console.log(`\n  ${total} rows total`);
  if (snapshot.retentionFloorLedger) {
    console.log(`  RPC retention floor at snapshot: ledger ${snapshot.retentionFloorLedger}`);
  }
  console.log(`  written to ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
