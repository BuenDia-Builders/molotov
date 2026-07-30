import { NextRequest, NextResponse } from "next/server";
import { IPFS_GATEWAYS } from "@/lib/ipfs-gateways";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;

  for (const gw of IPFS_GATEWAYS) {
    try {
      const res = await fetch(`${gw.url}/${cid}`, {
        headers: gw.auth ? { Authorization: `Bearer ${gw.auth}` } : {},
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "application/octet-stream";
      const body = await res.arrayBuffer();

      return new NextResponse(body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch {
      // try next gateway
    }
  }

  return NextResponse.json({ error: "IPFS fetch failed on all gateways" }, { status: 502 });
}
