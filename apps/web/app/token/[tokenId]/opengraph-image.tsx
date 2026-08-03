import { ImageResponse } from "next/og";
import { isDbConfigured, findTokenById, findActiveListingByToken, stroopsToXlm } from "@/lib/db";
import { fetchIpfs } from "@/lib/ipfs";
import { truncateAddress } from "@/lib/stellar";

/** Formats satori can rasterize; webp/svg would make the whole card 500. */
const EMBEDDABLE_TYPES = new Set(["image/png", "image/jpeg", "image/gif"]);
const MAX_EMBED_BYTES = 8 * 1024 * 1024;

/**
 * The client-side gateway helper returns a relative `/api/ipfs/<cid>` URL,
 * which satori rejects (it needs absolute URLs and would re-fetch anyway).
 * Fetch the bytes through the multi-gateway helper and inline them.
 */
async function loadArtworkDataUri(imageUri: string): Promise<string> {
  try {
    const res = await fetchIpfs(imageUri, {
      revalidate: 3600,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!EMBEDDABLE_TYPES.has(type)) return "";
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_EMBED_BYTES) return "";
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return "";
  }
}

export const alt = "Obra en Molotov";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Brand palette — keep in sync with app/globals.css. */
const BLACK = "#0A0A0A";
const CARBON = "#141414";
const SMOKE = "#6B6B6B";
const OFFWHITE = "#F5F4ED";
const BLUE = "#1564FF";

export default async function OgImage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  const id = Number(tokenId);

  let title = "";
  let imageUrl = "";
  let artist = "";
  let royaltyPct = "";
  let priceXlm: string | null = null;

  if (!isNaN(id) && isDbConfigured()) {
    try {
      const [token, listing] = await Promise.all([findTokenById(id), findActiveListingByToken(id)]);
      if (token) {
        artist = truncateAddress(token.artist);
        royaltyPct = (token.royalty_bps / 100).toFixed(0);
        if (listing) priceXlm = stroopsToXlm(listing.price);
        if (token.token_uri) {
          const meta = await fetchIpfs(token.token_uri, { revalidate: 3600 }).then(
            (r) => r.json() as Promise<{ name?: string; image?: string }>,
          );
          if (meta.name) title = meta.name;
          if (meta.image) imageUrl = await loadArtworkDataUri(meta.image);
        }
      }
    } catch {
      /* fall through to the text-only card */
    }
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: BLACK,
        color: OFFWHITE,
      }}
    >
      {/* Artwork */}
      <div
        style={{
          width: 630,
          height: 630,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: CARBON,
          overflow: "hidden",
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            width={630}
            height={630}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
        ) : (
          <div style={{ display: "flex", fontSize: 120, color: BLUE }}>◼</div>
        )}
      </div>

      {/* Text column */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 56px 48px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 8,
            color: SMOKE,
          }}
        >
          MOLOTOV
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: title.length > 26 ? 44 : 58,
              fontWeight: 700,
              lineHeight: 1.05,
              color: OFFWHITE,
            }}
          >
            {title || `Obra #${tokenId}`}
          </div>
          {artist ? (
            <div style={{ display: "flex", fontSize: 24, color: SMOKE }}>{artist}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {priceXlm ? (
            <div style={{ display: "flex", fontSize: 40, color: OFFWHITE }}>{priceXlm} XLM</div>
          ) : null}
          {royaltyPct ? (
            <div style={{ display: "flex", fontSize: 22, color: BLUE }}>
              {`${royaltyPct}% de regalía para quien la creó, en cada venta en Molotov`}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    size,
  );
}
