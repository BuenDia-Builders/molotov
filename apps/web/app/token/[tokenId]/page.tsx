import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { BuyButton } from "@/components/buy-button";
import { Nav } from "@/components/nav";
import { ipfsToGateway } from "@/lib/ipfs";
import { truncateAddress } from "@/lib/stellar";

async function getTokenData(tokenId: number) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
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
    };
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

  if (tokenRes.error) return null;

  let imageUrl = "";
  let title = "";
  const metaUri = tokenRes.data?.token_uri;
  if (metaUri) {
    try {
      const metaRes = await fetch(ipfsToGateway(metaUri), { next: { revalidate: 3600 } });
      const meta = await metaRes.json();
      if (meta.image) imageUrl = ipfsToGateway(meta.image);
      if (meta.name) title = meta.name;
    } catch {
      /* fall through to placeholder */
    }
  }

  return { token: tokenRes.data, listing: listingRes.data, imageUrl, title };
}

export default async function TokenPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  const id = Number(tokenId);
  if (isNaN(id)) notFound();

  const data = await getTokenData(id);
  if (!data) notFound();

  const { token, listing, imageUrl, title } = data;
  const imageSrc = imageUrl || "/icon-512.png";

  return (
    <div className="min-h-screen bg-[var(--black)]">
      <Nav />
      <div className="grid grid-cols-1 md:grid-cols-2 md:min-h-[calc(100vh-3rem)]">
        {/* Left — artwork, full-height, contained so nothing is cropped */}
        <div className="relative w-full min-h-[60vw] md:min-h-0 bg-[var(--carbon)] flex items-center justify-center">
          <Image
            src={imageSrc}
            alt={title || `Token ${token.token_id}`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>

        {/* Right — metadata */}
        <div className="flex flex-col justify-center px-8 py-14 md:px-12 md:py-20 lg:px-16">
          {/* Back + token number */}
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/works"
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--smoke)] transition-colors hover:text-[var(--offwhite)]"
            >
              ← Discover
            </Link>
            <span className="font-mono text-[10px] text-[var(--smoke)]/40">
              #{String(token.token_id).padStart(4, "0")}
            </span>
          </div>

          {/* Title — primary visual anchor */}
          {title && (
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4.5vw,3.75rem)] font-semibold leading-[0.96] tracking-[-0.025em] text-[var(--offwhite)] mb-8 [font-variation-settings:'opsz'_72]">
              {title}
            </h1>
          )}

          {/* Metadata rows */}
          <div className="space-y-3 border-t border-[var(--ember)] pt-6">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)]">
                Artist
              </span>
              <span className="font-mono text-[10px] text-[var(--offwhite)]">
                {truncateAddress(token.artist)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)]">
                Owner
              </span>
              <span className="font-mono text-[10px] text-[var(--offwhite)]">
                {truncateAddress(token.owner)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)]">
                Royalty
              </span>
              <span className="font-mono text-[10px] text-[var(--blue)]">
                {(token.royalty_bps / 100).toFixed(0)}% · {token.recipients_count}{" "}
                {token.recipients_count === 1 ? "recipient" : "recipients"}
              </span>
            </div>
          </div>

          {/* Manage link — shown when not listed */}
          {!listing && (
            <div className="mt-6">
              <Link
                href={`/my-work/${token.token_id}`}
                className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-[0.2em] underline-offset-4 hover:text-[var(--offwhite)] hover:underline transition-colors"
              >
                List for sale →
              </Link>
            </div>
          )}

          {/* Active Listing */}
          {listing && (
            <div className="mt-8 border border-[var(--blue)]/30 p-6">
              <p className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-[0.2em] mb-3">
                For sale
              </p>
              <p className="font-mono text-2xl text-[var(--offwhite)] mb-1">
                {(BigInt(listing.price) / BigInt(10_000_000)).toString()}{" "}
                <span className="text-sm text-[var(--smoke)]">XLM</span>
              </p>
              {listing.kind === "open_edition" && (
                <p className="font-mono text-[10px] text-[var(--smoke)] mb-4">
                  {listing.editions_sold}/{listing.editions_total} editions sold
                </p>
              )}
              <div className="mt-4">
                <BuyButton
                  listingId={BigInt(listing.listing_id)}
                  priceXlm={(BigInt(listing.price) / BigInt(10_000_000)).toString()}
                  tokenId={id}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
