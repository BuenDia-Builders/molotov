/**
 * One-off backfill of event wall-clock timestamps.
 *
 * Rows projected before migration 20260723000002 have NULL in their new timestamp
 * columns. The Soroban RPC still knows each ledger's close time, but only for
 * ledgers inside its retention window (~7 days on testnet) — past that, the
 * timestamp is unrecoverable and NULL is permanent. This script fills in whatever
 * the window still allows, and reports exactly where the cut falls so it can be
 * written down in doc/indexer-operations.md.
 *
 * `closed_at` is a property of the LEDGER, not of the event, so this never replays
 * business logic: it sweeps the window once to build a ledger → closeTime map and
 * then issues plain UPDATEs. In particular it never calls the apply_* functions, so
 * it cannot re-trigger apply_sold's editions_sold increment.
 *
 * Safe to re-run: every UPDATE is guarded by `IS NULL`, so it only ever fills gaps.
 *
 * Run from repo root:
 *   node_modules/.pnpm/node_modules/.bin/tsx apps/web/scripts/backfill-closed-at.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(import.meta.dirname, "../../../.env") });

/** Tables to backfill: the ledger column to match on, and the timestamp to fill. */
const TARGETS = [
  { table: "sales", ledgerColumn: "ledger", timeColumn: "closed_at" },
  { table: "token_transfers", ledgerColumn: "ledger", timeColumn: "closed_at" },
  { table: "tokens", ledgerColumn: "minted_at_ledger", timeColumn: "minted_at" },
  { table: "listings", ledgerColumn: "created_at_ledger", timeColumn: "created_at" },
] as const;

async function main() {
  const { rpc } = await import("@stellar/stellar-sdk");
  const { createClient } = await import("@supabase/supabase-js");
  const { RPC_URL, CONTRACT_IDS, POLL_LIMIT, SUPABASE_URL, SUPABASE_SECRET_KEY } =
    await import("../app/api/indexer/config.js");
  const { resolveOldestLedger } = await import("../app/api/indexer/poller.js");

  const server = new rpc.Server(RPC_URL);
  const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });

  const floor = await resolveOldestLedger();
  console.log(`[backfill] RPC retention floor: ledger ${floor}`);
  console.log("[backfill] sweeping the window to map ledger → close time…");

  // Sweep the retention window once, collecting one close time per ledger.
  const closeTimeByLedger = new Map<number, string>();
  let startOpts: { cursor: string } | { startLedger: number } = { startLedger: floor };
  let prevCursor: string | null = null;

  while (true) {
    const result = await server.getEvents({
      filters: [{ type: "contract", contractIds: [...CONTRACT_IDS] }],
      ...startOpts,
      limit: POLL_LIMIT,
    });

    for (const raw of result.events) {
      if (raw.ledgerClosedAt) closeTimeByLedger.set(raw.ledger, raw.ledgerClosedAt);
    }

    // Same tip detection as the poller: the cursor stops moving at the tip, and a
    // partial page means nothing is left ahead.
    if (result.cursor === prevCursor) break;
    if (result.events.length > 0 && result.events.length < POLL_LIMIT) break;
    prevCursor = result.cursor ?? prevCursor;
    if (!result.cursor) break;
    startOpts = { cursor: result.cursor };
  }

  console.log(`[backfill] mapped ${closeTimeByLedger.size} ledgers`);

  for (const { table, ledgerColumn, timeColumn } of TARGETS) {
    const { count: before } = await db
      .from(table)
      .select("*", { count: "exact", head: true })
      .is(timeColumn, null);

    let filled = 0;
    for (const [ledger, closedAt] of closeTimeByLedger) {
      const { data, error } = await db
        .from(table)
        .update({ [timeColumn]: closedAt })
        .eq(ledgerColumn, ledger)
        .is(timeColumn, null)
        .select(ledgerColumn);
      if (error) throw new Error(`${table}: ${error.message}`);
      filled += data?.length ?? 0;
    }

    const { count: after } = await db
      .from(table)
      .select("*", { count: "exact", head: true })
      .is(timeColumn, null);

    console.log(
      `[backfill] ${table}.${timeColumn}: filled ${filled}, ` +
        `still NULL ${after ?? 0} (was ${before ?? 0})`,
    );
  }

  console.log(
    `\n[backfill] done. Rows still NULL are events below ledger ${floor} — the RPC no ` +
      `longer serves them, so those timestamps are permanently unrecoverable.\n` +
      `[backfill] Record ledger ${floor} in doc/indexer-operations.md as the cut.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
