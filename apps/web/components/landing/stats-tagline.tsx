"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSignedIn } from "@/hooks/use-signed-in";
import { START_HREF } from "@/lib/routes";
import type { LandingStats } from "@/lib/db/landing";

/**
 * The promise, said plainly, in many tongues. One line at a time — Spanish
 * first because the house speaks Rioplatense.
 */
const HEADLINES = [
  "El arte le paga a quien lo hace.",
  "Art pays the one who makes it.",
  "A arte paga quem a faz.",
  "L'art paie qui le fait.",
  "藝術回報創作者。",
];

const ROTATE_MS = 3200;

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        const t0 = performance.now();
        const DURATION = 900;
        const step = (t: number) => {
          const p = Math.min((t - t0) / DURATION, 1);
          setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown.toLocaleString("es-AR")}
    </span>
  );
}

export function StatsTagline({ stats }: { stats: LandingStats }) {
  const { t } = useI18n();
  const isSignedIn = useSignedIn();
  const [headline, setHeadline] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setHeadline((h) => (h + 1) % HEADLINES.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  const counters = [
    { value: stats.works, label: t("landing.counters.works") },
    { value: stats.artists, label: t("landing.counters.artists") },
    { value: stats.collected, label: t("landing.counters.collected") },
  ];

  return (
    <section className="bg-[var(--offwhite)] px-6 py-16 text-center md:py-24">
      {/* Real numbers, small and true */}
      <div className="mx-auto flex max-w-3xl items-start justify-center gap-10 md:gap-20">
        {counters.map((c) => (
          <div key={c.label} className="flex flex-col gap-1">
            <span className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--black)] md:text-4xl">
              <CountUp value={c.value} />
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--black)]/45">
              {c.label}
            </span>
          </div>
        ))}
      </div>

      {/* Rotating headline */}
      <h2
        key={headline}
        className="tagline-fade mx-auto mt-14 font-[family-name:var(--font-display)] text-[clamp(1.9rem,5vw,3.4rem)] font-bold leading-tight text-[var(--black)]"
      >
        {HEADLINES[headline]}
      </h2>

      <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--black)]/70">
        {t("landing.tagline.description")}
      </p>

      {/* Signed out: same destination as the nav's Empezar (one constant).
          Signed in (wallet or email identity): onboarding no longer applies —
          the invitation is the art. */}
      <Link
        href={isSignedIn ? "/works" : START_HREF}
        className="mt-8 inline-flex h-11 items-center bg-[var(--black)] px-8 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--offwhite)] transition-colors hover:bg-[var(--blue)]"
      >
        {isSignedIn ? t("landing.tagline.ctaConnected") : t("landing.tagline.cta")}
      </Link>
    </section>
  );
}
