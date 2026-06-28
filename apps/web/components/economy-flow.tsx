"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

const FLOW = [
  {
    amountKey: "economy.flow.artist.amount",
    pctKey: "economy.flow.artist.pct",
    labelKey: "economy.flow.artist.label",
    noteKey: "economy.flow.artist.note",
    accent: true,
  },
  {
    amountKey: "economy.flow.molotov.amount",
    pctKey: "economy.flow.molotov.pct",
    labelKey: "economy.flow.molotov.label",
    noteKey: "economy.flow.molotov.note",
    accent: false,
  },
  {
    amountKey: "economy.flow.seller.amount",
    pctKey: "economy.flow.seller.pct",
    labelKey: "economy.flow.seller.label",
    noteKey: "economy.flow.seller.note",
    accent: false,
  },
] as const;

export function EconomyFlow() {
  const listRef = useRef<HTMLUListElement>(null);
  const [inView, setInView] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how" className="bg-[var(--offwhite)] scroll-mt-24">
      <div className="mx-auto max-w-7xl px-6 py-36 md:px-10 md:py-52 lg:px-20">
        <div className="grid gap-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-36">

          {/* Left: sale distribution */}
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--black)]/40">
              {t("economy.eyebrow")}
            </p>
            <p className="mt-8 font-[family-name:var(--font-display)] text-3xl leading-tight tracking-[-0.01em] text-[var(--black)] md:text-4xl">
              {t("economy.saleBefore")}{" "}
              <span className="font-[family-name:var(--font-mono)] text-2xl md:text-3xl">
                100&nbsp;XLM
              </span>
              {t("economy.saleAfter")}
            </p>

            <ul ref={listRef} className="mt-16 border-t border-black/10">
              {FLOW.map((row, i) => (
                <li
                  key={row.labelKey}
                  style={{ transitionDelay: `${i * 120}ms` }}
                  className={`reveal flex flex-col gap-1 border-b border-black/10 py-8 md:flex-row md:items-baseline md:gap-8 ${
                    inView ? "in" : ""
                  } ${row.accent ? "border-l-2 border-l-[var(--blue)] pl-5 md:pl-6" : ""}`}
                >
                  <div className="flex items-baseline gap-3 md:w-64">
                    <span aria-hidden className="text-[var(--black)]/30">
                      {t("economy.arrow")}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-2xl text-[var(--black)] md:text-3xl">
                      {t(row.amountKey)}
                      <span className="ml-1.5 text-sm text-[var(--black)]/40">XLM</span>
                    </span>
                  </div>
                  <div className="pl-7 md:pl-0">
                    <p className="text-base text-[var(--black)]">
                      {t(row.labelKey)}
                      <span className="ml-2 font-[family-name:var(--font-mono)] text-[12px] text-[var(--black)]/40">
                        {t(row.pctKey)}
                      </span>
                    </p>
                    <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--black)]/55">{t(row.noteKey)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: comparison */}
          <div className="flex flex-col justify-center">
            <p className="font-[family-name:var(--font-display)] text-2xl leading-snug text-[var(--black)] md:text-3xl">
              {t("economy.comparison")}
            </p>

            <dl className="mt-14 space-y-8">
              <div className="flex items-end justify-between border-b border-black/10 pb-6">
                <dt className="max-w-[60%] text-base text-[var(--black)]/50">{t("economy.streamingKeeps")}</dt>
                <dd className="font-[family-name:var(--font-mono)] text-4xl text-[var(--black)]/20 md:text-5xl">
                  ~70%
                </dd>
              </div>
              <div className="flex items-end justify-between border-b border-black/10 pb-6">
                <dt className="max-w-[60%] text-base text-[var(--black)]">{t("economy.molotovKeeps")}</dt>
                <dd className="font-[family-name:var(--font-mono)] text-4xl text-[var(--blue)] md:text-5xl">
                  2.5%
                </dd>
              </div>
            </dl>

            <p className="mt-10 max-w-md text-sm leading-[1.8] text-[var(--black)]/55">
              {t("economy.note")}
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
