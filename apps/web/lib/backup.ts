import { SUPABASE_URL, SUPABASE_SECRET_KEY } from "@/app/api/indexer/config";
import { resolveOldestLedger } from "@/app/api/indexer/poller";

/** FK order: parents first, so a restore can replay the file top to bottom. */
export const PROJECTION_TABLES = [
  "artists",
  "tokens",
  "listings",
  "sales",
  "token_transfers",
] as const;

export type ProjectionSnapshot = {
  takenAt: string;
  retentionFloorLedger: number | null;
  note: string;
  tables: Record<(typeof PROJECTION_TABLES)[number], unknown[]>;
};

/**
 * Read-only snapshot of the Supabase projection: every row in the five
 * projection tables, plus where the RPC retention window sat when it was
 * taken. Strictly SELECTs — never writes to the database.
 */
export async function buildProjectionSnapshot(): Promise<ProjectionSnapshot> {
  const headers = { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` };
  const tables = {} as Record<(typeof PROJECTION_TABLES)[number], unknown[]>;

  for (const table of PROJECTION_TABLES) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    tables[table] = (await res.json()) as unknown[];
  }

  // Where the RPC window sat when this ran: rows below this ledger were already
  // unrecoverable from the chain at snapshot time. Best-effort — a failure here
  // is not a reason to fail the snapshot itself.
  let retentionFloorLedger: number | null = null;
  try {
    retentionFloorLedger = await resolveOldestLedger();
  } catch {
    /* best-effort */
  }

  return {
    takenAt: new Date().toISOString(),
    retentionFloorLedger,
    note: "Read-only snapshot of the Supabase projection. Rows below retentionFloorLedger were already unrecoverable from the chain when this was taken.",
    tables,
  };
}
