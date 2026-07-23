/**
 * GET /api/indexer/health
 *
 * Liveness/observability for the indexer. Reports:
 *   - lagLedgers: distance between the cursor and the network tip.
 *   - retentionMarginLedgers: distance between the cursor and the RPC retention
 *     floor — the one that just bit us (cursor fell below it → events unfetchable).
 *   - lastAppliedAt: when the cursor last advanced successfully.
 *   - lastError: the event (ledger + index) currently blocking the poll, if any —
 *     so a poison event is diagnosable without log-diving. Cleared on the next
 *     successful advance.
 *
 * Returns 503 (unhealthy) if the lag exceeds MAX_LEDGER_LAG, the retention margin
 * drops below MIN_RETENTION_MARGIN, or an apply error is recorded; 200 otherwise.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rpc } from "@stellar/stellar-sdk";
import {
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  RPC_URL,
  MAX_LEDGER_LAG,
  MIN_RETENTION_MARGIN,
} from "../config";
import { resolveOldestLedger } from "../poller";

// service_role client — bypasses RLS to read indexer_cursor (anon has zero access).
const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const server = new rpc.Server(RPC_URL, { allowHttp: false });

type CursorRow = {
  last_ledger: number;
  updated_at: string;
  last_error_ledger: number | null;
  last_error_event_index: number | null;
  last_error_message: string | null;
  last_error_at: string | null;
};

export async function GET() {
  try {
    const [cursorRes, latest, oldestRetained] = await Promise.all([
      db
        .from("indexer_cursor")
        .select(
          "last_ledger, updated_at, last_error_ledger, last_error_event_index, last_error_message, last_error_at",
        )
        .eq("id", 1)
        .single(),
      server.getLatestLedger(),
      resolveOldestLedger(),
    ]);

    if (cursorRes.error) throw new Error(`cursor read: ${cursorRes.error.message}`);
    const c = cursorRes.data as CursorRow;

    const lagLedgers = latest.sequence - c.last_ledger;
    const retentionMarginLedgers = c.last_ledger - oldestRetained;
    const hasApplyError = c.last_error_ledger != null;

    const reasons: string[] = [];
    if (lagLedgers > MAX_LEDGER_LAG) {
      reasons.push(`lag ${lagLedgers} ledgers exceeds MAX_LEDGER_LAG (${MAX_LEDGER_LAG})`);
    }
    if (retentionMarginLedgers < MIN_RETENTION_MARGIN) {
      reasons.push(
        `retention margin ${retentionMarginLedgers} below MIN_RETENTION_MARGIN (${MIN_RETENTION_MARGIN})`,
      );
    }
    if (hasApplyError) {
      reasons.push(
        `apply error at ledger ${c.last_error_ledger} event_index ${c.last_error_event_index}`,
      );
    }

    const healthy = reasons.length === 0;
    return NextResponse.json(
      {
        healthy,
        cursorLedger: c.last_ledger,
        networkLatestLedger: latest.sequence,
        lagLedgers,
        retentionFloorLedger: oldestRetained,
        retentionMarginLedgers,
        lastAppliedAt: c.updated_at,
        lastError: hasApplyError
          ? {
              ledger: c.last_error_ledger,
              eventIndex: c.last_error_event_index,
              message: c.last_error_message,
              at: c.last_error_at,
            }
          : null,
        reasons,
      },
      { status: healthy ? 200 : 503 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ healthy: false, error: message }, { status: 503 });
  }
}
