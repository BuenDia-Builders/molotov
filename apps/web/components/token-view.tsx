"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BuyButton } from "@/components/buy-button";
import { ShareButton } from "@/components/share-button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useI18n } from "@/lib/i18n";
import { truncateAddress } from "@/lib/stellar";

export type TokenMeta = {
  title: string;
  description: string;
  imageUrl: string;
  tags: string[];
  category: string | null;
  license: string | null;
  nsfw: boolean;
  flashing: boolean;
  attributes: Array<{ trait_type: string; value: string }>;
};

export type TokenViewProps = {
  token: {
    token_id: number;
    artist: string;
    artistHandle: string | null;
    owner: string;
    royalty_bps: number;
    recipients_count: number;
  };
  listing: {
    listing_id: string;
    kind: string;
    editions_total: number | null;
    editions_sold: number | null;
  } | null;
  priceXlm: string | null;
  priceUsd: string | null;
  meta: TokenMeta;
};

const CATEGORY_LABEL_KEY = {
  illustration: "mint.form.categories.illustration",
  photography: "mint.form.categories.photography",
  painting: "mint.form.categories.painting",
  generative: "mint.form.categories.generative",
  "3d": "mint.form.categories.3d",
  animation: "mint.form.categories.animation",
  collage: "mint.form.categories.collage",
  "pixel-art": "mint.form.categories.pixel-art",
  other: "mint.form.categories.other",
} as const;

const LICENSE_LABEL_KEY = {
  "CC-BY-4.0": "mint.form.licenses.ccBy",
  "CC-BY-SA-4.0": "mint.form.licenses.ccBySa",
  "CC-BY-NC-4.0": "mint.form.licenses.ccByNc",
  "CC-BY-NC-SA-4.0": "mint.form.licenses.ccByNcSa",
  "CC0-1.0": "mint.form.licenses.cc0",
} as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)]">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Neutral stand-in for a work whose image is missing or could not be fetched.
 * Deliberately carries no brand mark: the app icon sitting in the artwork frame
 * reads as content an artist chose, not as an empty state. Same copy key as the
 * browse-grid card (components/token-card.tsx), so both surfaces say the same thing.
 */
function ArtworkPlaceholder({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex flex-col items-center justify-center gap-4 px-8 py-10 text-center"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10 text-white/20"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
        <line x1="2.5" y1="2.5" x2="21.5" y2="21.5" />
      </svg>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)]">
        {label}
      </span>
    </div>
  );
}

export function TokenView({ token, listing, priceXlm, priceUsd, meta }: TokenViewProps) {
  const { t } = useI18n();
  // Sensitive works ship blurred and reveal only on an explicit tap.
  const [revealed, setRevealed] = useState(!meta.nsfw);
  // A URL that is present but fails to load is the same state as a missing one,
  // so next/image's onError feeds the same placeholder.
  const [imageFailed, setImageFailed] = useState(false);

  const showPlaceholder = !meta.imageUrl || imageFailed;
  const title = meta.title || `#${token.token_id}`;

  const categoryKey =
    meta.category && meta.category in CATEGORY_LABEL_KEY
      ? CATEGORY_LABEL_KEY[meta.category as keyof typeof CATEGORY_LABEL_KEY]
      : null;
  const licenseKey =
    meta.license && meta.license in LICENSE_LABEL_KEY
      ? LICENSE_LABEL_KEY[meta.license as keyof typeof LICENSE_LABEL_KEY]
      : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 md:items-start">
      {/* ── Artwork ── the hero. A reserved 4:5 frame on mobile (no layout shift as
          the image loads) and a viewport-tall sticky column on desktop, so the work
          leads and stays in view while the sale details scroll. object-contain holds
          any aspect ratio without cropping. */}
      <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-[var(--carbon)] md:sticky md:top-12 md:aspect-auto md:h-[calc(100vh-3rem)]">
        {showPlaceholder ? (
          <ArtworkPlaceholder label={t("artwork.imageFallback")} />
        ) : (
          <Image
            src={meta.imageUrl}
            alt={title}
            fill
            onError={() => setImageFailed(true)}
            className={`object-contain transition-[filter] duration-300 ${revealed ? "" : "blur-2xl"}`}
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        )}
        {/* Nothing sensitive to conceal once the image is gone, so the veil stays
            with the real artwork only. */}
        {!showPlaceholder && !revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/40"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--offwhite)]">
              {t("tokenPage.sensitive")}
            </span>
            <span className="border border-white/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white">
              {t("tokenPage.sensitiveShow")}
            </span>
          </button>
        )}
      </div>

      {/* ── Details ── */}
      <div className="flex flex-col justify-center px-8 py-14 md:px-12 md:py-20 lg:px-16">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Breadcrumbs trail={[{ label: t("nav.discover"), href: "/works" }, { label: title }]} />
          <span className="font-mono text-[10px] text-[var(--smoke)]/40">
            #{String(token.token_id).padStart(4, "0")}
          </span>
        </div>

        {meta.title && (
          <h1 className="mb-8 font-[family-name:var(--font-display)] text-[clamp(2rem,4.5vw,3.75rem)] font-semibold leading-[0.96] tracking-[-0.025em] text-[var(--offwhite)] [font-variation-settings:'opsz'_72]">
            {meta.title}
          </h1>
        )}

        {meta.flashing && (
          <p className="mb-6 max-w-md border border-yellow-500/30 px-3 py-2 font-mono text-[10px] leading-relaxed text-yellow-200/80">
            ⚠ {t("tokenPage.flashingWarn")}
          </p>
        )}

        {meta.description && (
          <p className="mb-8 max-w-md whitespace-pre-line text-base leading-relaxed text-[var(--offwhite)]/70">
            {meta.description}
          </p>
        )}

        <div className="space-y-3 border-t border-[var(--ember)] pt-6">
          <Row label={t("tokenPage.artist")}>
            <Link
              href={`/artist/${token.artist}`}
              className="font-mono text-[10px] text-[var(--offwhite)] underline-offset-4 hover:underline"
            >
              {token.artistHandle ?? truncateAddress(token.artist)}
            </Link>
          </Row>
          <Row label={t("tokenPage.owner")}>
            <span className="font-mono text-[10px] text-[var(--offwhite)]">
              {truncateAddress(token.owner)}
            </span>
          </Row>
          <Row label={t("tokenPage.royalty")}>
            <span className="font-mono text-[10px] text-[var(--blue)]">
              {(token.royalty_bps / 100).toFixed(0)}% · {token.recipients_count}{" "}
              {token.recipients_count === 1
                ? t("tokenPage.recipientSingular")
                : t("tokenPage.recipientPlural")}
            </span>
          </Row>
          {categoryKey && (
            <Row label={t("tokenPage.category")}>
              <span className="font-mono text-[10px] text-[var(--offwhite)]">{t(categoryKey)}</span>
            </Row>
          )}
          <Row label={t("tokenPage.license")}>
            <span className="font-mono text-[10px] text-[var(--offwhite)]">
              {licenseKey ? t(licenseKey) : t("tokenPage.licenseAllRights")}
            </span>
          </Row>
          {meta.attributes.map((attr) => (
            <Row key={attr.trait_type} label={attr.trait_type}>
              <span className="font-mono text-[10px] text-[var(--offwhite)]">{attr.value}</span>
            </Row>
          ))}
        </div>

        {meta.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {meta.tags.map((tag) => (
              <span
                key={tag}
                className="border border-white/12 px-2.5 py-1 font-mono text-[10px] text-[var(--offwhite)]/70"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Share — the growth loop: the link carries the sharer's referral */}
        <div className="mt-8">
          <ShareButton path={`/token/${token.token_id}`} />
        </div>

        {!listing && (
          <div className="mt-6">
            <Link
              href={`/my-work/${token.token_id}`}
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)] underline-offset-4 transition-colors hover:text-[var(--offwhite)] hover:underline"
            >
              {t("tokenPage.listForSale")}
            </Link>
          </div>
        )}

        {listing && priceXlm && (
          <div className="mt-8 border border-[var(--blue)]/30 p-6">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)]">
              {t("tokenPage.forSale")}
            </p>
            <p className="mb-1 font-mono text-2xl text-[var(--offwhite)]">
              {priceXlm} <span className="text-sm text-[var(--smoke)]">XLM</span>
              {priceUsd && (
                <span className="ml-2 text-sm text-[var(--smoke)]/60">~US$ {priceUsd}</span>
              )}
            </p>
            {listing.kind === "open_edition" && (
              <p className="mb-4 font-mono text-[10px] text-[var(--smoke)]">
                {listing.editions_sold}/{listing.editions_total} {t("tokenPage.editionsSold")}
              </p>
            )}
            <p className="mt-4 font-mono text-[10px] leading-relaxed text-[var(--smoke)]">
              {t("tokenPage.buySteps")}
            </p>
            <div className="mt-4">
              <BuyButton
                listingId={BigInt(listing.listing_id)}
                priceXlm={priceXlm}
                tokenId={token.token_id}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
