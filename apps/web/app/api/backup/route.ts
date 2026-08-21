/**
 * GET /api/backup
 *
 * Read-only snapshot of the Supabase projection (see doc/indexer-operations.md,
 * "Backups"). Runs server-side using the same SUPABASE_URL / SUPABASE_SECRET_KEY
 * already configured for the indexer — no separate credentials to manage.
 *
 * Same auth pattern as /api/indexer:
 *   Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { buildProjectionSnapshot } from "@/lib/backup";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
    }
  } else {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const snapshot = await buildProjectionSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[backup] snapshot error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
