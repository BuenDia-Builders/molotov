"use client";

import Image from "next/image";
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

export function HeroContent({ work }: { work: FeaturedWork }) {
  const { t } = useI18n();

  return (
    <section className="relative flex min-h-screen flex-col md:flex-row bg-[var(--offwhite)]">
      {/* Mobile-only artwork strip */}
      {work.image && (
        <div className="relative h-56 sm:h-72 overflow-hidden md:hidden">
          <Image
            src={work.image}
            alt={work.title}
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-5 py-4">
            <p className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.25em] text-white/60">
              {work.artist_short}
            </p>
            <p className="font-[family-name:var(--font-display)] text-sm text-white/90 mt-0.5 truncate [font-variation-settings:'opsz'_24]">
              {work.title}
            </p>
          </div>
        </div>
      )}

      {/* Text content */}
      <div className="flex flex-1 flex-col md:max-w-[60%]">
        {/* Brand label */}
        <div className="px-6 pt-10 md:px-10 md:pt-14 lg:px-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.4em] text-[var(--black)]/35">
            MOLOTOV
          </p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-[var(--black)]/20">
            {t("hero.eyebrow")}
          </p>
        </div>

        {/* Headline */}
        <div className="flex flex-1 flex-col justify-center px-6 pb-20 pt-10 md:px-10 md:pb-28 md:pt-12 lg:px-20">
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(4.5rem,16vw,15rem)] font-light leading-[0.88] tracking-[-0.03em] text-[var(--black)] [font-variation-settings:'opsz'_144]">
            {t("hero.headlineMain")}
            <br />
            <em className="not-italic text-[var(--blue)]">{t("hero.headlinePlus")}</em>
          </h1>

          <p className="mt-12 max-w-sm text-base leading-[1.75] text-[var(--black)]/50">
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
              className="inline-block border border-[var(--black)]/15 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--black)]/50 px-7 py-3 transition-colors hover:border-[var(--black)]/40 hover:text-[var(--black)]"
            >
              {t("hero.mintYours")}
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="flex flex-col items-start gap-1.5 px-6 pb-12 md:px-10 lg:px-20">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--black)]/25">
            {t("hero.scroll")}
          </p>
          <span aria-hidden className="text-[var(--black)]/20 text-sm">
            ↓
          </span>
        </div>
      </div>

      {/* Desktop artwork panel */}
      {work.image && (
        <div className="hidden md:block relative" style={{ width: "40%" }}>
          <Image
            src={work.image}
            alt={work.title}
            fill
            className="object-cover"
            priority
            sizes="40vw"
          />
          {/* caption overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 to-transparent px-6 py-6">
            <p className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.25em] text-white/55">
              {work.artist_short}
            </p>
            <p className="font-[family-name:var(--font-display)] text-base text-white/90 mt-1 truncate [font-variation-settings:'opsz'_24]">
              {work.title}
            </p>
            {work.price_xlm && (
              <p className="font-[family-name:var(--font-mono)] text-[10px] text-white/40 mt-1">
                {work.price_xlm} XLM
              </p>
            )}
          </div>
          {/* "Latest work" badge */}
          <div className="absolute top-5 right-5">
            <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-white/40 border border-white/15 px-2 py-1">
              Latest work
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
