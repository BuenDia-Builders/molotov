import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { stellarAddress, validationError } from "@/lib/validators";

const checkLimit = rateLimit({ windowMs: 60_000, max: 30 });

export async function GET(req: NextRequest) {
  const limited = checkLimit(req);
  if (limited) return limited;

  const raw = req.nextUrl.searchParams.get("wallet");
  const parsed = stellarAddress.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error.issues[0].message);
  const wallet = parsed.data;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { data, error } = await db
    .from("token_effective_owner")
    .select("token_id, token_uri, owner, artist, royalty_bps, effective_owner, active_listing_id")
    .or(`effective_owner.eq.${wallet},artist.eq.${wallet}`)
    .order("token_id", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json([]);

  // Fetch prices for any active listings
  const listingIds = data.map((t) => t.active_listing_id).filter((id): id is string => id != null);

  const priceMap: Record<string, string> = {};
  if (listingIds.length > 0) {
    const { data: listings } = await db
      .from("listings")
      .select("listing_id, price")
      .in("listing_id", listingIds);
    if (listings) {
      for (const l of listings) {
        priceMap[l.listing_id] = (BigInt(l.price) / 10_000_000n).toString();
      }
    }
  }

  const result = data.map((t) => ({
    ...t,
    price_xlm: t.active_listing_id ? priceMap[t.active_listing_id] : undefined,
  }));

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
