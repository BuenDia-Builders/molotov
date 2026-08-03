import Image from "next/image";
import Link from "next/link";
import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDbConfigured, findTokenById, findActiveListingByToken, stroopsToXlm } from "@/lib/db";
import { BuyButton } from "@/components/buy-button";
import { Nav } from "@/components/nav";
import { ReferralCapture } from "@/components/referral-capture";
import { ShareButton } from "@/components/share-button";
import { fetchIpfs, ipfsToGateway } from "@/lib/ipfs";
import { truncateAddress } from "@/lib/stellar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}): Promise<Metadata> {
  const fallback: Metadata = { title: "Obra — Molotov" };
  try {
    const { tokenId } = await params;
    const id = Number(tokenId);
    if (isNaN(id)) return fallback;

    const data = await getTokenData(id);
    if (!data || "error" in data) return fallback;

    const { token, listing, title } = data;
    const displayTitle = title || `Obra #${token.token_id}`;
    const artist = truncateAddress(token.artist);
    const royaltyPct = (token.royalty_bps / 100).toFixed(0);
    const description = listing
      ? `${artist} · ${stroopsToXlm(listing.price)} XLM · ${royaltyPct}% de regalía para quien la creó, en cada venta en Molotov.`
      : `${artist} · ${royaltyPct}% de regalía para quien la creó, en cada venta en Molotov.`;

    return {
      title: `${displayTitle} — Molotov`,
      description,
      openGraph: {
        title: `${displayTitle} — Molotov`,
        description,
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title: `${displayTitle} — Molotov`,
        description,
      },
    };
  } catch {
    return fallback;
  }
}

// cache(): generateMetadata and the page render both need this — one fetch per request.
const getTokenData = cache(async (tokenId: number) => {
  if (!isDbConfigured()) return { error: true as const };

  const [token, listing] = await Promise.all([
    findTokenById(tokenId),
    findActiveListingByToken(tokenId),
  ]);

  if (!token) return null;

  let imageUrl = "";
  let title = "";
  if (token.token_uri) {
    try {
      const metaRes = await fetchIpfs(token.token_uri, { revalidate: 3600 });
      const meta = await metaRes.json();
      if (meta.image) imageUrl = ipfsToGateway(meta.image);
      if (meta.name) title = meta.name;
    } catch {
      /* fall through to placeholder */
    }
  }

  return { token, listing, imageUrl, title };
});

export default async function TokenPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  const id = Number(tokenId);
  if (isNaN(id)) notFound();

  const data = await getTokenData(id);
  if (!data) notFound();

  if ("error" in data) {
    return (
      <div className="min-h-screen bg-[var(--black)]">
        <Nav />
        <div className="flex flex-col items-center justify-center px-8 py-40 text-center">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-red-500">
            Could not load this work
          </p>
          <p className="mt-3 font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--smoke)]">
            On-chain data is unavailable right now.
          </p>
          <Link
            href="/works"
            className="mt-6 font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--offwhite)] underline-offset-4 hover:underline"
          >
            ← Discover
          </Link>
        </div>
      </div>
    );
  }

  const { token, listing, imageUrl, title } = data;
  const imageSrc = imageUrl || "/icon-512.png";

  return (
    <div className="min-h-screen bg-[var(--black)]">
      <Nav />
      <Suspense fallback={null}>
        <ReferralCapture tokenId={id} />
      </Suspense>
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
              <Link
                href={`/artist/${token.artist}`}
                className="font-mono text-[10px] text-[var(--offwhite)] underline-offset-4 hover:underline"
              >
                {truncateAddress(token.artist)}
              </Link>
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

          {/* Share — the growth loop: the link carries the sharer's referral */}
          <div className="mt-8">
            <ShareButton path={`/token/${token.token_id}`} />
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
                {stroopsToXlm(listing.price)}{" "}
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
                  priceXlm={stroopsToXlm(listing.price)}
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
