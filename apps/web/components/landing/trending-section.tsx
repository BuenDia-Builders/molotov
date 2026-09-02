"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ArtworkCard } from "@/components/artwork-card";
import type { LandingCollection } from "@/lib/db/landing";

export type TrendingItem = {
  tokenId: number;
  title: string;
  artist: string;
  image: string | null;
  priceXlm: string | null;
  priceUsd: string | null;
  sold: boolean;
};

type Props = {
  collections: LandingCollection[];
  works: TrendingItem[];
};

/**
 * "Colecciones en tendencia" once curated collections exist; until then the
 * same slot ranks real works (on sale first, then sold, then newest) — an
 * honest ordering at today's catalog size, not a popularity model.
 */
export function TrendingSection({ collections, works }: Props) {
  const { t } = useI18n();
  const showCollections = collections.length > 0;

  if (!showCollections && works.length === 0) return null;

  return (
    <section className="bg-[var(--offwhite)] px-6 pb-20 md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-baseline justify-between border-b border-black/10 pb-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--black)] md:text-2xl">
            {showCollections
              ? t("landing.trending.collectionsTitle")
              : t("landing.trending.worksTitle")}
          </h2>
          <Link
            href={showCollections ? "/works" : "/works"}
            className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--black)]/50 underline-offset-4 hover:text-[var(--black)] hover:underline"
          >
            {showCollections
              ? t("landing.trending.viewCollections")
              : t("landing.trending.viewWorks")}{" "}
            ↗
          </Link>
        </div>

        {showCollections ? (
          <ol className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((c, i) => (
              <li key={c.slug} className="flex items-center gap-4 border-b border-black/5 py-3">
                <span className="w-6 font-[family-name:var(--font-mono)] text-[11px] text-[var(--black)]/35">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-[family-name:var(--font-mono)] text-[13px] text-[var(--black)]">
                    {c.title}
                  </p>
                  <p className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--black)]/45">
                    {c.tokenCount}{" "}
                    {c.tokenCount === 1
                      ? t("landing.trending.piecesSingular")
                      : t("landing.trending.piecesPlural")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {works.map((w) => (
              <ArtworkCard
                key={w.tokenId}
                tokenId={w.tokenId}
                title={w.title}
                imageUrl={w.image}
                artistAddress={w.artist}
                priceXlm={w.priceXlm}
                priceUsd={w.priceUsd}
                status={w.priceXlm ? "for-sale" : w.sold ? "sold" : "not-listed"}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
