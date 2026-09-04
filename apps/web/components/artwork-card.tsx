"use client";

import Image from "next/image";
import Link from "next/link";
import { truncateAddress } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";

/**
 * Shared with /works: the home page's "trending" grid and the discover grid
 * showed the same works in two different visual languages (a dense list vs.
 * a real card). One card, used by both, so home and discover read as the
 * same product.
 */
export type ArtworkCardStatus = "for-sale" | "sold" | "not-listed";

export type ArtworkCardProps = {
  tokenId: number;
  title: string;
  imageUrl: string | null;
  artistAddress: string;
  artistHandle?: string | null;
  royaltyPct?: number;
  priceXlm: string | null;
  priceUsd?: string | null;
  status: ArtworkCardStatus;
};

export function ArtworkCard({
  tokenId,
  title,
  imageUrl,
  artistAddress,
  artistHandle,
  royaltyPct,
  priceXlm,
  priceUsd,
  status,
}: ArtworkCardProps) {
  const { t } = useI18n();
  const artistLabel = artistHandle ?? truncateAddress(artistAddress, 4, 4);

  return (
    <Link
      href={`/token/${tokenId}`}
      className="group flex flex-col bg-[var(--carbon)] overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-[var(--blue-deep)] to-[var(--blue)]">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        )}
        {/* subtle token number watermark */}
        <span className="absolute bottom-3 right-4 font-[family-name:var(--font-mono)] text-[40px] font-bold text-white/4 leading-none select-none pointer-events-none">
          {String(tokenId).padStart(2, "0")}
        </span>
      </div>

      {/* Caption — a label under the work, not a spec sheet: one quiet metadata
          line, gentler tracking, no ruled row separating title from price. */}
      <div className="px-5 py-5 flex flex-col gap-1.5">
        <p className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.14em] uppercase text-[var(--smoke)]/80 truncate">
          {artistLabel}
        </p>
        <p className="font-[family-name:var(--font-display)] font-bold text-[var(--offwhite)] text-[1.05rem] leading-snug truncate">
          {title}
        </p>
        <div className="flex items-center justify-between mt-2.5">
          {royaltyPct !== undefined ? (
            <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.1em] uppercase text-[var(--smoke)]/50">
              {royaltyPct}% royalty
            </span>
          ) : (
            <span />
          )}
          {status === "for-sale" && priceXlm ? (
            <span className="text-right font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]">
              {priceXlm} <span className="text-[var(--smoke)]">XLM</span>
              {priceUsd && <span className="ml-1.5 text-[var(--smoke)]/60">~US$ {priceUsd}</span>}
            </span>
          ) : status === "sold" ? (
            <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.1em] text-[var(--smoke)]/60">
              {t("works.card.sold")}
            </span>
          ) : (
            <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.1em] text-[var(--smoke)]/35">
              {t("works.card.notListed")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
