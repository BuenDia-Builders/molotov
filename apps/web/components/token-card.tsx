"use client";

import Image from "next/image";
import Link from "next/link";

export interface TokenCardProps {
  tokenId: number;
  tokenUri: string; // IPFS URI — resolved to gateway URL internally
  owner: string; // bech32 Stellar address
  artist: string; // bech32 Stellar address
  royaltyBps: number; // e.g. 1000 = 10%
  price?: string; // stroops as string — optional, only if listed
  currency?: string; // contract address or symbol
  listingId?: number; // only if listed
}

function resolveUri(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return uri;
}

function truncateAddr(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

const STROOPS_PER_XLM = 10_000_000n;

export function TokenCard({
  tokenId,
  tokenUri,
  artist,
  royaltyBps,
  price,
}: TokenCardProps) {
  const imageUrl = resolveUri(tokenUri);
  const royaltyPercent = (royaltyBps / 100).toFixed(0);
  const priceXLM = price
    ? (BigInt(price) / STROOPS_PER_XLM).toString()
    : null;

  return (
    <article className="bg-[var(--carbon)] border border-[var(--ember)] transition-colors duration-150 hover:border-[var(--blue)]">
      {/* Image — 1:1 ratio */}
      <div className="relative aspect-square w-full overflow-hidden">
        <Image
          src={imageUrl}
          alt={`Token #${tokenId}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>

      {/* Token ID + royalty row */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--ember)]">
        <span className="font-mono text-xs text-[var(--offwhite)]">
          #{String(tokenId).padStart(4, "0")}
        </span>
        <span className="font-mono text-[10px] text-[var(--blue)] border border-[var(--blue)] px-1.5 py-0.5">
          {royaltyPercent}% royalty
        </span>
      </div>

      {/* Artist row */}
      <p className="font-mono text-[10px] text-[var(--smoke)] px-4 py-2">
        {truncateAddr(artist)}
      </p>

      {/* Price + CTA — only if listed */}
      {priceXLM && (
        <div className="flex justify-between items-center px-4 pb-4">
          <span className="font-mono text-sm text-[var(--offwhite)]">
            {priceXLM} XLM
          </span>
          <Link
            href={`/token/${tokenId}`}
            className="bg-[var(--blue)] text-white font-bold text-[10px] tracking-widest uppercase px-4 py-2"
          >
            Buy
          </Link>
        </div>
      )}
    </article>
  );
}