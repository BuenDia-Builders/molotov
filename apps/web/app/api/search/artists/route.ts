import { NextRequest, NextResponse } from "next/server";
// Direct module imports (not the @/lib/db barrel): the barrel drags every db
// module into this route's compile unit for no benefit.
import { getDb, isDbConfigured } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";

// Artist search behind the nav search box. Matches team-assigned handles
// (contains, case-insensitive) and address prefixes (Stellar addresses are
// uppercase base32, so the query is uppercased for that arm). Handle search
// simply finds nothing until the profiles migration is applied.
const checkLimit = rateLimit({ windowMs: 60_000, max: 30 });

type Row = { address: string; handle?: string | null };

export async function GET(request: NextRequest) {
  const limited = checkLimit(request);
  if (limited) return limited;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2 || !isDbConfigured()) return NextResponse.json({ results: [] });

  const db = getDb();
  const safe = q.replace(/[%_,()]/g, "");
  if (!safe) return NextResponse.json({ results: [] });

  const { data, error } = await db
    .from("artists")
    .select("address, handle")
    .eq("revoked", false)
    .or(`handle.ilike.%${safe.toLowerCase()}%,address.ilike.${safe.toUpperCase()}%`)
    .limit(8);

  if (error) {
    // Pre-migration schema (no handle column): fall back to address-only.
    const { data: bare } = await db
      .from("artists")
      .select("address")
      .eq("revoked", false)
      .ilike("address", `${safe.toUpperCase()}%`)
      .limit(8);
    return NextResponse.json({
      results: ((bare ?? []) as Row[]).map((a) => ({ address: a.address, handle: null })),
    });
  }

  return NextResponse.json({
    results: ((data ?? []) as Row[]).map((a) => ({ address: a.address, handle: a.handle ?? null })),
  });
}
