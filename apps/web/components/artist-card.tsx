"use client";

// Client component moved out of apps/web/app/artists/page.tsx.
//
// Why: the ArtistCard markup needs useI18n() for two visible strings (the count
// badge and the preview fallback), but artists/page.tsx is an async Server
// Component where that hook cannot run. So the card is extracted here as a client
// component and the page renders <ArtistCard artist={...} />.
//
// How: markup, classNames, and non-string logic are identical to the original.
// Only the two string sites were swapped to t() calls (landing.trending.pieces*
// for the badge, artists.previewUnavailable / myWork.noWorks for the fallback).
// Both the component and its ArtistCard prop type are exported for the page import.

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export type ArtistCard = {
  address: string;
  short: string;
  /** Team-curated handle; the card shows it when it exists. */
  handle: string | null;
  tokenCount: number;
  latestTokenId: number | null;
  latestImage: string | null;
  latestTitle: string | null;
};

export function ArtistCard({ artist }: { artist: ArtistCard }) {
  const { t } = useI18n();
  const card = (
    <article className="group flex flex-col bg-[var(--carbon)] overflow-hidden transition-transform duration-300 hover:-translate-y-0.5">
      {/* Artwork thumbnail */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[var(--blue-deep)] to-[var(--blue)]">
        {artist.latestImage ? (
          <Image
            src={artist.latestImage}
            alt={artist.latestTitle ?? artist.short}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-white/20">
              {artist.tokenCount > 0 ? t("artists.previewUnavailable") : t("myWork.noWorks")}
            </span>
          </div>
        )}
        <span className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm border border-white/15 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.15em] text-white/60">
          {artist.tokenCount}{" "}
          {artist.tokenCount === 1
            ? t("landing.trending.piecesSingular")
            : t("landing.trending.piecesPlural")}
        </span>
      </div>

      {/* Caption */}
      <div className="px-5 py-4">
        <p className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-[var(--smoke)] mb-1">
          Artist
        </p>
        <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--offwhite)] truncate">
          {artist.handle ?? artist.short}
        </p>
        {artist.latestTitle && (
          <p className="mt-1 font-[family-name:var(--font-display)] text-[var(--smoke)] text-sm truncate [font-variation-settings:'opsz'_18]">
            Latest: {artist.latestTitle}
          </p>
        )}
      </div>
    </article>
  );

  return <Link href={`/artist/${artist.handle ?? artist.address}`}>{card}</Link>;
}
