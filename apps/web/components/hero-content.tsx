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
  const royaltyPct = (work.royalty_bps / 100).toFixed(work.royalty_bps % 100 === 0 ? 0 : 1);

  return (
    <section className="relative flex flex-col md:flex-row md:min-h-screen bg-[var(--carbon)]">

      {/* Left column — text */}
      <div className="w-full md:w-1/2 px-6 pt-16 pb-10 md:pt-32 md:pb-24 md:pl-16 md:pr-12 flex flex-col justify-center">
        <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] text-[var(--smoke)] uppercase">
          {t("hero.eyebrow")}
        </span>
        <div className="w-16 h-px bg-[var(--ember)] mb-6 mt-4" />
        <h1 className="font-[family-name:var(--font-display)] font-black text-[clamp(2.4rem,5.5vw,5rem)] leading-[0.92] text-[var(--offwhite)]">
          {t("hero.titleBeforeEm")}{" "}
          <em className="not-italic text-[var(--blue)]">{t("hero.titleEm")}</em>{" "}
          {t("hero.titleAfterEm")}
        </h1>
        <p className="font-[family-name:var(--font-body)] text-base text-[var(--smoke)] mt-5 leading-relaxed max-w-sm">
          {t("hero.body")}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/works"
            className="inline-block bg-[var(--blue)] text-white font-[family-name:var(--font-mono)] text-[10px] tracking-widest uppercase px-7 py-3 transition-opacity hover:opacity-80"
          >
            {t("hero.exploreWorks")}
          </Link>
          <Link
            href="/create"
            className="inline-block border border-[var(--ember)] text-[var(--offwhite)] font-[family-name:var(--font-mono)] text-[10px] tracking-widest uppercase px-7 py-3 transition-colors hover:border-[var(--offwhite)]"
          >
            {t("hero.mintYours")}
          </Link>
        </div>
      </div>

      {/* Right column — featured work */}
      <div className="w-full md:w-1/2 h-[70vw] md:h-auto md:min-h-screen overflow-hidden relative bg-gradient-to-br from-[var(--blue-deep)] to-[var(--blue)]">
        {work.image && (
          <Image
            src={work.image}
            alt={work.title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        <Link
          href="/works"
          className="absolute top-4 right-4 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] uppercase text-white/60 hover:text-white transition-colors"
        >
          {t("hero.allWorks")}
        </Link>

        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.25em] uppercase text-[var(--blue)] mb-1 truncate">
                #{String(work.token_id).padStart(4, "0")} · {work.artist_short}
              </p>
              <p className="font-[family-name:var(--font-display)] font-black text-xl md:text-[clamp(1.5rem,3vw,2.5rem)] leading-none text-white truncate">
                {work.title}
              </p>
            </div>
            <div className="text-right shrink-0">
              {work.price_xlm && (
                <p className="font-[family-name:var(--font-mono)] text-lg md:text-xl font-bold text-white leading-none">
                  {work.price_xlm} <span className="text-white/50 text-sm">XLM</span>
                </p>
              )}
              <p className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.2em] uppercase text-[var(--blue)] mt-1">
                {royaltyPct}{t("hero.royaltySuffix")}
              </p>
            </div>
          </div>
          <Link
            href={`/token/${work.token_id}`}
            className="mt-4 inline-block bg-white text-black font-[family-name:var(--font-mono)] font-bold text-[10px] tracking-widest uppercase px-5 py-2.5 transition-opacity hover:opacity-80"
          >
            {t("hero.viewWork")}
          </Link>
        </div>
      </div>

    </section>
  );
}
