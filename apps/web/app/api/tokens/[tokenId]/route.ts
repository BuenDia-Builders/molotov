import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { tokenId as tokenIdSchema, validationError } from "@/lib/validators";

const checkLimit = rateLimit({ windowMs: 60_000, max: 60 });

export async function GET(req: NextRequest, props: { params: Promise<{ tokenId: string }> }) {
  const limited = checkLimit(req);
  if (limited) return limited;

  const params = await props.params;
  const parsed = tokenIdSchema.safeParse(params.tokenId);
  if (!parsed.success) return validationError("Invalid token ID");
  const tokenId = parsed.data;

  // If Supabase is not configured yet, return mock data for UI testing
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({
      token: {
        token_id: tokenId,
        token_uri: "/icon-512.png",
        owner: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890XYZ",
        artist: "GDEF1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890XYZ",
        royalty_bps: 1000,
        recipients_count: 2,
        minted_at_ledger: 1000,
      },
      listing: {
        listing_id: "1",
        price: "500000000",
        currency: "native",
        kind: "open_edition",
        editions_total: 100,
        editions_sold: 42,
        ends_at: null,
      },
    });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const [tokenRes, listingRes] = await Promise.all([
    db
      .from("tokens")
      .select("token_id, token_uri, owner, artist, royalty_bps, recipients_count, minted_at_ledger")
      .eq("token_id", tokenId)
      .single(),
    db
      .from("listings")
      .select("listing_id, price, currency, kind, editions_total, editions_sold, ends_at")
      .eq("token_id", tokenId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (tokenRes.error) return NextResponse.json({ error: tokenRes.error.message }, { status: 404 });

  return NextResponse.json(
    { token: tokenRes.data, listing: listingRes.data },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" } },
  );
}
