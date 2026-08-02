import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured, findTokenById, findActiveListingByToken, stroopsToXlm } from "@/lib/db";
import { BuyButton } from "@/components/buy-button";
import { Nav } from "@/components/nav";
import { fetchIpfs, ipfsToGateway } from "@/lib/ipfs";
import { truncateAddress } from "@/lib/stellar";

async function getTokenData(tokenId: number) {
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
}

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
      <div className="grid grid-cols-1 md:grid-cols-2 md:min-h-[calc(100vh-3rem)]">
        {/* Left — artwork. The frame is sized up front (aspect on mobile,
            full column height on desktop) so the image loads into reserved
            space: no layout shift, no cropping at any aspect ratio. Sticky on
            desktop so the work stays while the sale data scrolls beside it. */}
        <div className="relative w-full aspect-[4/5] md:aspect-auto md:h-[calc(100vh-3rem)] md:sticky md:top-12 bg-[var(--carbon)] flex items-center justify-center overflow-hidden">
          {/* Subtle gallery glow behind the work — existing tokens only. */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--blue)_7%,transparent)_0%,transparent_65%)]"
          />
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
