"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function FeaturedWork() {
  const { t } = useI18n();

  return (
    <section className="mx-auto max-w-7xl px-6 py-36 md:px-10 md:py-52 lg:px-20">
      <div className="max-w-2xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-[-0.01em] [font-variation-settings:'opsz'_72] md:text-5xl">
          {t("featured.titleBefore")}{" "}
          <em className="italic text-[var(--blue)]">{t("featured.titleEm")}</em>
        </h2>
        <p className="mt-8 max-w-md text-base leading-[1.75] text-[var(--offwhite)]/70">
          {t("featured.body")}
        </p>
      </div>

      <div className="mt-20 grid grid-cols-1 gap-px overflow-hidden border border-white/12 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1].map((i) => (
          <article key={i} className="bg-[var(--black)] p-4">
            <div className="flex aspect-[4/5] items-center justify-center border border-dashed border-white/15">
              <span className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.22em] text-[var(--offwhite)]/40">
                {t("featured.emptySlot")}
              </span>
            </div>
            <div className="mt-4 h-12" aria-hidden />
          </article>
        ))}

        <article className="bg-[var(--black)] p-4">
          <div className="relative flex aspect-[4/5] items-center justify-center border border-dashed border-[var(--blue)]/50">
            <span className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.22em] text-[var(--blue)]">
              {t("featured.emptySlot")}
            </span>
            <span className="absolute right-3 top-3 border border-white/15 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-[var(--offwhite)]/60">
              {t("featured.royaltyBadge")}
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-[family-name:var(--font-display)] text-lg [font-variation-settings:'opsz'_24]">
                {t("featured.artworkTitle")}
              </p>
              <p className="truncate text-sm text-[var(--offwhite)]/60">{t("featured.artistName")}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--offwhite)]">
                {t("featured.xlmDash")}
              </p>
              <p className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--offwhite)]/40">
                {t("featured.usdDash")}
              </p>
            </div>
          </div>
        </article>
      </div>

      <div className="mt-16">
        <Link
          href="/create"
          className="inline-flex h-12 items-center justify-center bg-[var(--blue)] px-7 text-[15px] font-medium text-white transition-colors hover:bg-[var(--blue-light)]"
        >
          {t("common.mintFirst")}
        </Link>
      </div>
    </section>
  );
}
