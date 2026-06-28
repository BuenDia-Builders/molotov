import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { tokenId as tokenIdSchema, validationError } from "@/lib/validators";
import { isDbConfigured, findTokenById, findActiveListingByToken } from "@/lib/db";

const checkLimit = rateLimit({ windowMs: 60_000, max: 60 });

export async function GET(req: NextRequest, props: { params: Promise<{ tokenId: string }> }) {
  const limited = checkLimit(req);
  if (limited) return limited;

  const params = await props.params;
  const parsed = tokenIdSchema.safeParse(params.tokenId);
  if (!parsed.success) return validationError("Invalid token ID");
  const tokenId = parsed.data;

  if (!isDbConfigured()) {
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
        seller: "",
      },
    });
  }

  const [token, listing] = await Promise.all([
    findTokenById(tokenId),
    findActiveListingByToken(tokenId),
  ]);

  if (!token) return NextResponse.json({ error: "Token not found" }, { status: 404 });

  return NextResponse.json(
    { token, listing },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" } },
  );
}
