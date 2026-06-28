"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

function EmptyCard({ slot }: { slot: number }) {
  const { t } = useI18n();
  return (
    <article className="flex flex-col bg-[var(--black)]">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
        <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.25em] text-[var(--offwhite)]/20">
          #{String(slot).padStart(3, "0")}
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.2em] text-[var(--offwhite)]/15">
          STELLAR · MOLOTOV
        </span>
      </div>

      {/* Image area */}
      <div className="flex aspect-[4/5] items-center justify-center border-b border-dashed border-white/10">
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--offwhite)]/20">
          {t("featured.emptySlot")}
        </span>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-[family-name:var(--font-display)] text-base text-[var(--offwhite)]/30 [font-variation-settings:'opsz'_18]">
            {t("featured.artworkTitle")}
          </p>
          <p className="shrink-0 font-[family-name:var(--font-mono)] text-sm text-[var(--offwhite)]/25">
            {t("featured.xlmDash")}
          </p>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <p className="text-xs text-[var(--offwhite)]/20">{t("featured.artistName")}</p>
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]/20">
            {t("featured.usdDash")}
          </p>
        </div>

        {/* Stats */}
        <div className="mt-4 space-y-2 border-t border-white/8 pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-[var(--offwhite)]/25">
              {t("featured.royaltyStatLabel")}
            </span>
            <div className="flex items-center gap-2">
              <div className="h-px w-16 bg-white/10" />
              <span className="font-[family-name:var(--font-mono)] text-[9px] text-[var(--offwhite)]/20">—%</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-[var(--offwhite)]/15">
              {t("featured.networkLabel")}
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[9px] text-[var(--offwhite)]/15">
              {t("featured.networkValue")}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function FeaturedCard() {
  const { t } = useI18n();
  const royaltyPct = 10;
  const barWidth = `${royaltyPct}%`;

  return (
    <article className="flex flex-col bg-[var(--black)]">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
        <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.25em] text-[var(--blue)]">
          #001
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.2em] text-[var(--offwhite)]/30">
          STELLAR · MOLOTOV
        </span>
      </div>

      {/* Image area */}
      <div className="relative flex aspect-[4/5] items-center justify-center border-b border-dashed border-[var(--blue)]/40">
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--blue)]">
          {t("featured.emptySlot")}
        </span>
        <span className="absolute right-3 top-3 border border-white/15 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-[var(--offwhite)]/60">
          {t("featured.royaltyBadge")}
        </span>
        <span className="absolute bottom-3 left-3 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.2em] text-[var(--offwhite)]/30">
          {t("featured.editionLabel")}
        </span>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-[family-name:var(--font-display)] text-lg text-[var(--offwhite)] [font-variation-settings:'opsz'_24]">
            {t("featured.artworkTitle")}
          </p>
          <p className="shrink-0 font-[family-name:var(--font-mono)] text-sm text-[var(--offwhite)]">
            {t("featured.xlmDash")}
          </p>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <p className="text-sm text-[var(--offwhite)]/50">{t("featured.artistName")}</p>
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]/40">
            {t("featured.usdDash")}
          </p>
        </div>

        {/* Stats */}
        <div className="mt-4 space-y-2 border-t border-white/8 pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-[var(--offwhite)]/40">
              {t("featured.royaltyStatLabel")}
            </span>
            <div className="flex items-center gap-2">
              <div className="relative h-px w-16 bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--blue)]"
                  style={{ width: barWidth }}
                />
              </div>
              <span className="font-[family-name:var(--font-mono)] text-[9px] text-[var(--blue)]">
                {royaltyPct}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-[var(--offwhite)]/25">
              {t("featured.networkLabel")}
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[9px] text-[var(--offwhite)]/25">
              {t("featured.networkValue")}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function FeaturedWork() {
  const { t } = useI18n();

  return (
    <section className="bg-[var(--offwhite)]">
      <div className="mx-auto max-w-7xl px-6 py-36 md:px-10 md:py-52 lg:px-20">

        {/* Header — shifted right */}
        <div className="ml-auto max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-[-0.01em] text-[var(--black)] [font-variation-settings:'opsz'_72] md:text-5xl">
            {t("featured.titleBefore")}{" "}
            <em className="italic text-[var(--blue)]">{t("featured.titleEm")}</em>
          </h2>
          <p className="mt-8 max-w-md text-base leading-[1.75] text-[var(--black)]/60">
            {t("featured.body")}
          </p>
        </div>

        {/* Card grid */}
        <div className="mt-20 grid grid-cols-1 gap-px bg-black/8 sm:grid-cols-2 lg:grid-cols-3">
          <EmptyCard slot={2} />
          <EmptyCard slot={3} />
          <FeaturedCard />
        </div>

        <div className="mt-16">
          <Link
            href="/create"
            className="inline-flex h-12 items-center justify-center bg-[var(--black)] px-7 text-[15px] font-medium text-[var(--offwhite)] transition-colors hover:bg-[var(--blue)]"
          >
            {t("common.mintFirst")}
          </Link>
        </div>

      </div>
    </section>
  );
}
