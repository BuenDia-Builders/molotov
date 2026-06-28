import { NextResponse } from "next/server";
import { isDbConfigured, getActiveListingsWithTokens } from "@/lib/db";

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  try {
    const data = await getActiveListingsWithTokens(12);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
