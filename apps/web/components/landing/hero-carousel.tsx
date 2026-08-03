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
  priceXlm: string | null;
};

const ADVANCE_MS = 6000;

/** Full-width auto-advancing artwork carousel with dots. Pauses on hover. */
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

  if (slides.length === 0) return null;
  const active = slides[Math.min(index, slides.length - 1)];

  return (
    <section
      className="relative h-[62vh] min-h-[380px] w-full overflow-hidden bg-[var(--carbon)] md:h-[72vh]"
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
            sizes="100vw"
            priority={i === 0}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        </div>
      ))}

      {/* Caption */}
      <Link
        href={`/token/${active.tokenId}`}
        className="absolute bottom-10 left-6 z-10 flex flex-col gap-1 md:left-12"
      >
        <span className="font-[family-name:var(--font-display)] text-2xl font-bold leading-tight text-white md:text-4xl">
          {active.title}
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-white/70">
          {truncateAddress(active.artist, 4, 4)}
          {active.priceXlm && (
            <span className="ml-3 text-[var(--blue-light)]">
              {t("landing.hero.forSale")} · {active.priceXlm} XLM
            </span>
          )}
        </span>
        <span className="mt-2 w-fit border border-white/40 px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-white transition-colors hover:border-white">
          {t("landing.hero.viewWork")} →
        </span>
      </Link>

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
    </section>
  );
}
