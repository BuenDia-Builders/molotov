"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

// Option (b): the empty frame as statement. No placeholder gradients, no fake
// artworks. The vacancy is the invitation — and it doubles as a preview of the
// real card anatomy (media on top, metadata below).
export function FeaturedWork() {
  const { t } = useI18n();

  return (
    <section className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-36 lg:px-16">
      <div className="max-w-2xl">
        <h2 className="font-[family-name:var(--font-fraunces)] text-3xl leading-tight tracking-[-0.01em] [font-variation-settings:'opsz'_72] md:text-5xl">
          {t("featured.titleBefore")}{" "}
          <em className="italic text-[#0178DE]">{t("featured.titleEm")}</em>
        </h2>
        <p className="mt-6 max-w-md text-base leading-relaxed text-[#F5F4ED]/70">
          {t("featured.body")}
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-white/12 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
        {/* Two pure-empty frames... */}
        {[0, 1].map((i) => (
          <article key={i} className="bg-[#0A0A0B] p-4">
            <div className="flex aspect-[4/5] items-center justify-center border border-dashed border-white/15">
              <span className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.22em] text-[#F5F4ED]/40">
                {t("featured.emptySlot")}
              </span>
            </div>
            <div className="mt-4 h-12" aria-hidden />
          </article>
        ))}

        {/* ...and one frame showing the real card anatomy and metadata. */}
        <article className="bg-[#0A0A0B] p-4">
          <div className="relative flex aspect-[4/5] items-center justify-center border border-dashed border-[#0178DE]/50">
            <span className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.22em] text-[#0178DE]">
              {t("featured.emptySlot")}
            </span>
            <span className="absolute right-3 top-3 rounded-full border border-white/15 px-2 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-[#F5F4ED]/60">
              {t("featured.royaltyBadge")}
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-[family-name:var(--font-fraunces)] text-lg [font-variation-settings:'opsz'_24]">
                {t("featured.artworkTitle")}
              </p>
              <p className="truncate text-sm text-[#F5F4ED]/60">{t("featured.artistName")}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]">
                {t("featured.xlmDash")}
              </p>
              <p className="font-[family-name:var(--font-geist-mono)] text-[12px] text-[#F5F4ED]/40">
                {t("featured.usdDash")}
              </p>
            </div>
          </div>
        </article>
      </div>

      <div className="mt-12">
        <Link
          href="/crear"
          className="inline-flex h-12 items-center justify-center rounded-md bg-[#0178DE] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[#3493E5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4ED]"
        >
          {t("common.mintFirst")}
        </Link>
      </div>
    </section>
  );
}
