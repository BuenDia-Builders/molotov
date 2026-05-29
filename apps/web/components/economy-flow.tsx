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
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="como-cobras"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 md:px-10 md:py-36 lg:px-16"
    >
      <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-24">
        {/* Left: the literal distribution of a single sale. */}
        <div>
          <p className="font-[family-name:var(--font-geist-mono)] text-[13px] uppercase tracking-[0.18em] text-[#F5F4ED]/40">
            {t("economy.eyebrow")}
          </p>
          <p className="mt-4 font-[family-name:var(--font-fraunces)] text-3xl leading-tight tracking-[-0.01em] [font-variation-settings:'opsz'_72] md:text-4xl">
            {t("economy.saleBefore")}{" "}
            <span className="font-[family-name:var(--font-geist-mono)] text-2xl md:text-3xl">
              100&nbsp;XLM
            </span>
            {t("economy.saleAfter")}
          </p>

          <ul ref={listRef} className="mt-12 border-t border-white/12">
            {FLOW.map((row, i) => (
              <li
                key={row.labelKey}
                style={{ transitionDelay: `${i * 120}ms` }}
                className={`reveal flex flex-col gap-1 border-b border-white/12 py-6 md:flex-row md:items-baseline md:gap-8 ${
                  inView ? "in" : ""
                } ${row.accent ? "border-l-2 border-l-[#0178DE] pl-5 md:pl-6" : ""}`}
              >
                <div className="flex items-baseline gap-3 md:w-64">
                  <span aria-hidden className="text-[#F5F4ED]/40">
                    {t("economy.arrow")}
                  </span>
                  <span className="font-[family-name:var(--font-geist-mono)] text-2xl text-[#F5F4ED] md:text-3xl">
                    {t(row.amountKey)}
                    <span className="ml-1.5 text-sm text-[#F5F4ED]/40">XLM</span>
                  </span>
                </div>
                <div className="pl-7 md:pl-0">
                  <p className="text-base text-[#F5F4ED]">
                    {t(row.labelKey)}
                    <span className="ml-2 font-[family-name:var(--font-geist-mono)] text-[12px] text-[#F5F4ED]/40">
                      {t(row.pctKey)}
                    </span>
                  </p>
                  <p className="mt-0.5 max-w-sm text-sm text-[#F5F4ED]/60">{t(row.noteKey)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: the comparison as a statement, not a stat. */}
        <div className="flex flex-col justify-center">
          <p className="font-[family-name:var(--font-fraunces)] text-2xl leading-snug [font-variation-settings:'opsz'_40] md:text-3xl">
            {t("economy.comparison")}
          </p>

          <dl className="mt-12 space-y-8">
            <div className="flex items-end justify-between border-b border-white/12 pb-4">
              <dt className="text-base text-[#F5F4ED]/60">{t("economy.streamingKeeps")}</dt>
              <dd className="font-[family-name:var(--font-geist-mono)] text-4xl text-[#F5F4ED]/40 md:text-5xl">
                ~70%
              </dd>
            </div>
            <div className="flex items-end justify-between border-b border-white/12 pb-4">
              <dt className="text-base text-[#F5F4ED]">{t("economy.molotovKeeps")}</dt>
              <dd className="font-[family-name:var(--font-geist-mono)] text-4xl text-[#0178DE] md:text-5xl">
                2,5%
              </dd>
            </div>
          </dl>

          <p className="mt-8 max-w-md text-sm leading-relaxed text-[#F5F4ED]/60">
            {t("economy.note")}
          </p>
        </div>
      </div>
    </section>
  );
}
