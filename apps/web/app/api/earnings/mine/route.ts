import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { stellarAddress, validationError } from "@/lib/validators";
import { isDbConfigured, getArtistEarnings } from "@/lib/db";

const checkLimit = rateLimit({ windowMs: 60_000, max: 30 });

export async function GET(req: NextRequest) {
  const limited = checkLimit(req);
  if (limited) return limited;

  const raw = req.nextUrl.searchParams.get("wallet");
  const parsed = stellarAddress.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error.issues[0].message);
  const wallet = parsed.data;

  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const earnings = await getArtistEarnings(wallet);
    return NextResponse.json(earnings, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
