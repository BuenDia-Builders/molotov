import { NextRequest, NextResponse } from "next/server";
import { IPFS_GATEWAYS } from "@/lib/ipfs-gateways";

// CIDv0 (base58btc, Qm…) or CIDv1 (base32 lower, b…). The cid segment is
// minter-controlled; reject anything else before it reaches a gateway URL.
const CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,110})$/;

// A minter-supplied SVG served from our own origin with an executable
// content-type is a stored-XSS vector. Force download + a locked-down CSP so a
// direct navigation can never run script in the Molotov origin. Subresource
// <img>/<Image> loads ignore these headers, so artwork still renders — the
// gateway's Content-Type is preserved untouched.
const HARDENED_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "Access-Control-Allow-Origin": "*",
  "Content-Disposition": "attachment",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;

  if (!CID_RE.test(cid)) {
    return NextResponse.json({ error: "Invalid CID" }, { status: 400 });
  }

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
        headers: { "Content-Type": contentType, ...HARDENED_HEADERS },
      });
    } catch {
      // try next gateway
    }
  }

  return NextResponse.json({ error: "IPFS fetch failed on all gateways" }, { status: 502 });
}
