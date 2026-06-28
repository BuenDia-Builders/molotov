"use client";

import Link from "next/link";

export function Hero() {
  return (
    <section className="relative flex min-h-screen bg-[var(--carbon)]">
      {/* Left column: text */}
      <div className="w-1/2 pt-32 pb-24 pl-16 flex flex-col justify-center">
        {/* Eyebrow */}
        <span className="font-mono text-[10px] tracking-[0.3em] text-[var(--smoke)] uppercase">
          MOLOTOV
        </span>

        {/* Divider */}
        <div className="w-full h-px bg-[var(--ember)] mb-8 mt-4" />

        {/* Headline */}
        <h1 className="font-[family-name:var(--font-display)] font-black text-[80px] leading-none text-[var(--offwhite)]">
          The fire is yours.
        </h1>

        {/* Subline */}
        <p className="font-[family-name:var(--font-body)] text-lg text-[var(--smoke)] mt-6 leading-relaxed">
          Fire is on-chain.
          <br />
          So is the royalty.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex items-center">
          <Link
            href="/"
            className="inline-block bg-[var(--blue)] text-white font-bold text-xs tracking-widest uppercase px-8 py-3 mr-4"
          >
            Explore works
          </Link>
          <Link
            href="/create"
            className="inline-block border border-[var(--ember)] text-[var(--offwhite)] font-bold text-xs tracking-widest uppercase px-8 py-3"
          >
            Mint yours →
          </Link>
        </div>
      </div>

      {/* Right column: visual placeholder */}
      <div className="w-1/2 bg-[var(--blue)] h-screen overflow-hidden relative">
        <div className="w-full h-full flex items-center justify-center">
          <span className="font-mono text-[10px] tracking-[0.3em] text-[var(--smoke)] uppercase">
            Live works loading...
          </span>
        </div>
      </div>
    </section>
  );
}