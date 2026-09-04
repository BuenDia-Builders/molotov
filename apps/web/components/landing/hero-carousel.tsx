"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { truncateAddress } from "@/lib/stellar";

export type HeroSlide = {
  tokenId: number;
  image: string;
  title: string;
  artist: string;
  artistHandle: string | null;
  priceXlm: string | null;
  priceUsd: string | null;
};

const ADVANCE_MS = 6000;

/**
 * The first thing anyone sees: a short, plain statement of what Molotov is,
 * a dual artist/collector CTA (both reachable with zero scrolling), and a
 * *contained* artwork panel — not a 100vw banner, so a lower-resolution
 * upload doesn't read as a broken hero. The text panel renders even with an
 * empty catalog (`slides.length === 0`); only the image panel disappears —
 * previously the whole hero vanished on an empty DB, leaving the value prop
 * unstated until the user scrolled past it.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % Math.max(slides.length, 1));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    timer.current = setInterval(advance, ADVANCE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [advance, paused, slides.length]);

  const active = slides.length > 0 ? slides[Math.min(index, slides.length - 1)] : null;

  return (
    <section className="w-full bg-[var(--black)] px-6 py-14 md:px-12 md:py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-center md:gap-16">
        {/* Text panel — the value prop, stated plainly, always rendered */}
        <div className="flex flex-col gap-6 md:w-[42%] md:shrink-0">
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.05] text-white">
            {t("landing.hero.headline")}
          </h1>
          <p className="max-w-md text-base leading-relaxed text-white/70">
            {t("landing.tagline.description")}
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/create"
              className="inline-flex h-12 items-center justify-center bg-[var(--blue)] px-7 text-[15px] font-medium text-white transition-colors hover:bg-[var(--blue-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--offwhite)]"
            >
              {t("common.mintFirst")}
            </Link>
            <Link
              href="/works"
              className="inline-flex h-12 items-center px-2 font-[family-name:var(--font-mono)] text-[14px] text-[var(--offwhite)]/70 underline-offset-4 transition-colors hover:text-[var(--offwhite)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)]"
            >
              {t("common.collectorsSeeWorks")}
            </Link>
          </div>
        </div>

        {/* Image panel — contained, not full-bleed; hidden entirely on an empty catalog */}
        {active && (
          <div
            className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--carbon)] md:aspect-[4/5] md:w-[58%] md:max-h-[560px]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {slides.map((slide, i) => (
              <div
                key={slide.tokenId}
                className={`absolute inset-0 transition-opacity duration-700 ${i === index ? "opacity-100" : "opacity-0"}`}
                aria-hidden={i !== index}
              >
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 58vw"
                  priority={i === 0}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              </div>
            ))}

            {/* Caption */}
            <Link
              href={`/token/${active.tokenId}`}
              className="absolute bottom-6 left-5 z-10 flex flex-col gap-1"
            >
              <span className="font-[family-name:var(--font-display)] text-xl font-bold leading-tight text-white md:text-2xl">
                {active.title}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-white/70">
                {active.artistHandle ?? truncateAddress(active.artist, 4, 4)}
                {active.priceXlm && (
                  <span className="ml-3 text-[var(--blue-light)]">
                    {t("landing.hero.forSale")} · {active.priceXlm} XLM
                    {active.priceUsd && (
                      <span className="text-white/50"> · ~US$ {active.priceUsd}</span>
                    )}
                  </span>
                )}
              </span>
              <span className="mt-2 w-fit border border-white/40 px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-white transition-colors hover:border-white">
                {t("landing.hero.viewWork")} →
              </span>
            </Link>

            {/* Prev / next arrows */}
            {slides.length > 1 && (
              <>
                <button
                  aria-label="‹"
                  onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
                  className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-black/30 text-2xl leading-none text-white/80 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
                >
                  ‹
                </button>
                <button
                  aria-label="›"
                  onClick={() => setIndex((i) => (i + 1) % slides.length)}
                  className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-black/30 text-2xl leading-none text-white/80 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
                >
                  ›
                </button>
              </>
            )}

            {/* Dots */}
            {slides.length > 1 && (
              <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                {slides.map((slide, i) => (
                  <button
                    key={slide.tokenId}
                    aria-label={`${t("landing.hero.slideLabel")} #${slide.tokenId}`}
                    onClick={() => setIndex(i)}
                    className={`h-2 w-2 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/35 hover:bg-white/60"}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
