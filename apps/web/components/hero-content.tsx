"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export type FeaturedWork = {
  token_id: number;
  title: string;
  artist_short: string;
  royalty_bps: number;
  price_xlm?: string;
  image?: string;
};

export function HeroContent({ work: _work }: { work: FeaturedWork }) {
  const { t } = useI18n();

  return (
    <section className="relative flex min-h-screen flex-col bg-[var(--carbon)]">

      {/* Brand label — left, below nav */}
      <div className="px-6 pt-28 md:px-10 md:pt-36 lg:px-20">
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.4em] text-[var(--offwhite)]/35">
          MOLOTOV
        </p>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-[var(--offwhite)]/20">
          {t("hero.eyebrow")}
        </p>
      </div>

      {/* HUGE statement headline */}
      <div className="flex flex-1 flex-col justify-center px-6 pb-20 pt-10 md:px-10 md:pb-28 md:pt-12 lg:px-20">
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(4.5rem,16vw,15rem)] font-light leading-[0.88] tracking-[-0.03em] text-[var(--offwhite)] [font-variation-settings:'opsz'_144]">
          {t("hero.headlineMain")}
          <br />
          <em className="not-italic text-[var(--blue)]">{t("hero.headlinePlus")}</em>
        </h1>

        <p className="mt-12 max-w-sm text-base leading-[1.75] text-[var(--offwhite)]/50">
          {t("hero.body")}
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/works"
            className="inline-block bg-[var(--blue)] font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-white px-7 py-3 transition-opacity hover:opacity-80"
          >
            {t("hero.exploreWorks")}
          </Link>
          <Link
            href="/create"
            className="inline-block border border-[var(--offwhite)]/20 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--offwhite)]/60 px-7 py-3 transition-colors hover:border-[var(--offwhite)]/50 hover:text-[var(--offwhite)]"
          >
            {t("hero.mintYours")}
          </Link>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="flex flex-col items-start gap-1.5 px-6 pb-12 md:px-10 lg:px-20">
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--offwhite)]/25">
          {t("hero.scroll")}
        </p>
        <span aria-hidden className="text-[var(--offwhite)]/20 text-sm">↓</span>
      </div>

    </section>
  );
}
